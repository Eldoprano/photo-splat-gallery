import { useEffect, useRef, useCallback, useState } from 'react'
import { useStore } from '../store'
import * as THREE from 'three'
import { SplatMesh, SplatFileType, dyno } from '@sparkjsdev/spark'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useDeviceOrientation } from '../hooks/useDeviceOrientation'
import { Camera, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'

interface SplatViewerProps {
    enableTiltControl?: boolean
    enableXR?: boolean
}

// Everforest bg-hard color
import { CAMERA_SETTINGS, BG_COLOR } from '../constants'

declare global {
    interface Window {
        isSplatLoaded: boolean;
    }
}


function getFileType(filename: string): SplatFileType | undefined {
    const ext = filename.toLowerCase().split('.').pop()
    switch (ext) {
        case 'splat': return SplatFileType.SPLAT
        case 'ksplat': return SplatFileType.KSPLAT
        case 'spz': return SplatFileType.SPZ
        default: return undefined
    }
}

export default function SplatViewer({ enableTiltControl = false, enableXR = false }: SplatViewerProps) {
    const { currentSplat, currentSplatId, currentSplatFormat, setCurrentSplat, setViewMode, isStatic } = useStore()
    const containerRef = useRef<HTMLDivElement>(null)
    const sceneRef = useRef<THREE.Scene | null>(null)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
    const controlsRef = useRef<OrbitControls | null>(null)
    const contentGroupRef = useRef<THREE.Group | null>(null)
    const splatRef = useRef<SplatMesh | null>(null)
    const animationIdRef = useRef<number | null>(null)
    const keysRef = useRef<Set<string>>(new Set())
    const animateTimeRef = useRef<{ value: number } | null>(null)
    const loadStartTimeRef = useRef<number>(0)
    const isPointcloudRef = useRef<{ value: number }>({ value: 0 })

    const [isSaving, setIsSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [isDeleting, setIsDeleting] = useState(false)

    // AR State
    const isARSessionActiveRef = useRef(false)

    const flySpeedRef = useRef(0.05)
    const { orientation, hasPermission } = useDeviceOrientation()

    // Clean mode synchronously
    const isMinimal = new URLSearchParams(window.location.search).get('clean') === 'true'
    const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, '')
    const pendingConfigRef = useRef<{ position: number[], target: number[], up: number[] } | null>(null)

    // Fetch initial config
    useEffect(() => {
        if (!currentSplatId || currentSplatId === 'deep-linked') return;

        fetch(`${BASE_URL}/configs/${currentSplatId}.json`)
            .then(res => {
                if (res.ok) return res.json();
                return null;
            })
            .then(config => {
                if (config) {
                    // If camera is ready, apply immediately
                    if (cameraRef.current && controlsRef.current) {
                        console.log("Applying saved view config...", config);
                        cameraRef.current.position.fromArray(config.position);
                        cameraRef.current.up.fromArray(config.up);
                        controlsRef.current.target.fromArray(config.target);
                        controlsRef.current.update();
                    } else {
                        // Store for later application
                        pendingConfigRef.current = config;
                    }
                }
            })
            .catch(() => {
                // Ignore 404s
            });
    }, [currentSplatId, BASE_URL]);

    const handleSaveView = async () => {
        if (!cameraRef.current || !controlsRef.current || !currentSplatId || !rendererRef.current) return;

        setIsSaving(true);

        // Capture current view as thumbnail
        let thumbnail: string | undefined;
        try {
            // Render one frame to ensure we capture current state
            if (sceneRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
            thumbnail = rendererRef.current.domElement.toDataURL('image/jpeg', 0.9);
        } catch (e) {
            console.warn('Could not capture thumbnail:', e);
        }

        const payload = {
            position: cameraRef.current.position.toArray(),
            target: controlsRef.current.target.toArray(),
            up: cameraRef.current.up.toArray(),
            thumbnail // Include thumbnail if captured
        };

        try {
            const res = await fetch(`/api/splats/${currentSplatId}/view`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setSaveStatus('success');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } else {
                setSaveStatus('error');
                setTimeout(() => setSaveStatus('idle'), 2000);
            }
        } catch (e) {
            console.error(e);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!currentSplatId || !confirm("Are you sure you want to delete this splat? This cannot be undone.")) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/splats/${currentSplatId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setCurrentSplat(null);
                setViewMode('gallery');
            } else {
                alert("Failed to delete splat");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to delete splat");
        } finally {
            setIsDeleting(false);
        }
    };

    // Tilt control (Parallax Effect)
    useEffect(() => {
        if (!enableTiltControl || !hasPermission || !contentGroupRef.current || isARSessionActiveRef.current) return
        const { beta, gamma } = orientation
        if (beta === null || gamma === null) return

        // Parallax effect: Move content OPPOSITE to tilt
        // Beta: x-axis tilt (front/back) -> move Y
        // Gamma: y-axis tilt (left/right) -> move X
        const sensitivity = 0.05 // Subtle movement
        const maxOffset = 1.0 // Max translation units

        // Normalize angles (-45 to 45 degrees mostly relevant for holding)
        const normalizedBeta = Math.max(-45, Math.min(45, beta)) / 45
        const normalizedGamma = Math.max(-45, Math.min(45, gamma)) / 45

        // Target positions
        const targetX = normalizedGamma * maxOffset * sensitivity
        const targetY = -normalizedBeta * maxOffset * sensitivity // Negative because tilting back (pos beta) should move content down? or up?
        // Actually: Tilting phone TOP back (pos beta) -> user looks "down" into scene -> content should move UP to reveal bottom?
        // Standard Parallax: Move content opposite to camera movement.
        // Tilting phone right (pos gamma) -> Camera moves right -> Content should move LEFT (negative X).

        // We lerp for smoothness in the animation loop usually, but here is reactive.
        // Direct assignment is okay if sensor rate is high, but lerp is better.
        // For simplicity in this useEffect, we'll straight assign but dampened by sensitivity.

        // Note: Tilt control works best when "looking through a window".
        contentGroupRef.current.position.x = -targetX
        contentGroupRef.current.position.y = targetY

    }, [orientation, enableTiltControl, hasPermission])

    // Keyboard
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        keysRef.current.add(e.key.toLowerCase())
        // Spacebar toggles pointcloud mode
        if (e.key === ' ') {
            isPointcloudRef.current.value = isPointcloudRef.current.value > 0.5 ? 0 : 1
            if (splatRef.current) splatRef.current.updateVersion()
        }
    }, [])

    const handleKeyUp = useCallback((e: KeyboardEvent) => {
        keysRef.current.delete(e.key.toLowerCase())
    }, [])

    // WASD fly
    const applyFlyMovement = useCallback(() => {
        if (!cameraRef.current || !controlsRef.current) return
        const camera = cameraRef.current
        const controls = controlsRef.current
        const speed = flySpeedRef.current
        const keys = keysRef.current

        const forward = new THREE.Vector3()
        camera.getWorldDirection(forward)
        const right = new THREE.Vector3()
        // Use camera.up for correct left/right since up is inverted
        right.crossVectors(forward, camera.up).normalize()

        let moved = false
        if (keys.has('w')) { camera.position.addScaledVector(forward, speed); moved = true }
        if (keys.has('s')) { camera.position.addScaledVector(forward, -speed); moved = true }
        if (keys.has('a')) { camera.position.addScaledVector(right, -speed); moved = true }
        if (keys.has('d')) { camera.position.addScaledVector(right, speed); moved = true }
        if (keys.has('q')) { camera.position.y -= speed; moved = true }
        if (keys.has('e')) { camera.position.y += speed; moved = true }

        if (moved) controls.target.copy(camera.position).add(forward)
        flySpeedRef.current = keys.has('shift') ? 0.15 : 0.05
    }, [])

    // Main setup
    useEffect(() => {
        if (!containerRef.current || !currentSplat) return

        console.log('[SplatViewer] Loading:', currentSplat)

        // Cleanup
        if (animationIdRef.current) {
            cancelAnimationFrame(animationIdRef.current)
            animationIdRef.current = null
        }
        if (splatRef.current) {
            splatRef.current.dispose()
            splatRef.current = null
        }
        if (rendererRef.current && containerRef.current) {
            try { containerRef.current.removeChild(rendererRef.current.domElement) } catch { }
            rendererRef.current.dispose()
            rendererRef.current = null
        }
        // Remove AR Button if it exists
        const oldArBtn = document.getElementById('ar-button')
        if (oldArBtn) oldArBtn.remove()

        // Scene
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(BG_COLOR)
        sceneRef.current = scene

        // Content Group (for splat and tilt/AR manipulations)
        const contentGroup = new THREE.Group()
        scene.add(contentGroup)
        contentGroupRef.current = contentGroup

        // Camera - standard settings
        const camera = new THREE.PerspectiveCamera(
            60,
            containerRef.current.clientWidth / containerRef.current.clientHeight,
            0.01,
            1000
        )
        camera.position.copy(CAMERA_SETTINGS.position)
        camera.up.copy(CAMERA_SETTINGS.up)
        camera.lookAt(CAMERA_SETTINGS.target)
        cameraRef.current = camera

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true }) // No AA for mobile perf
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
        renderer.setPixelRatio(1) // Force 1x pixel ratio for mobile performance
        renderer.xr.enabled = true
        containerRef.current.appendChild(renderer.domElement)
        rendererRef.current = renderer

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.1
        controls.rotateSpeed = 0.4
        controls.zoomSpeed = 0.5
        controls.target.copy(CAMERA_SETTINGS.target)
        controls.update()
        controlsRef.current = controls

        // Apply pending config if it was fetched before camera was ready
        if (pendingConfigRef.current) {
            console.log("Applying pending config...", pendingConfigRef.current);
            camera.position.fromArray(pendingConfigRef.current.position);
            camera.up.fromArray(pendingConfigRef.current.up);
            controls.target.fromArray(pendingConfigRef.current.target);
            controls.update();
            pendingConfigRef.current = null;
        }

        // AR Session Logic
        // Register the enterAR function to the store so UIOverlay can call it
        const { setEnterAR, setIsARActive } = useStore.getState() // Access store directly inside effect to avoid deps issues if possible or use hook outside

        // Define the AR starter function
        const startAR = async () => {
            if (!renderer || !navigator.xr) return
            try {
                const session = await navigator.xr.requestSession('immersive-ar', {
                    requiredFeatures: ['hit-test'],
                    optionalFeatures: ['dom-overlay'],
                    domOverlay: { root: containerRef.current! }
                })
                renderer.xr.setReferenceSpaceType('local')
                await renderer.xr.setSession(session)

                // Session listener
                session.addEventListener('end', () => {
                    setIsARActive(false)
                    isARSessionActiveRef.current = false
                    scene.background = new THREE.Color(BG_COLOR)

                    // Reset content
                    if (contentGroupRef.current) {
                        contentGroupRef.current.position.set(0, 0, 0)
                        contentGroupRef.current.scale.setScalar(1)
                        contentGroupRef.current.rotation.set(0, 0, 0)
                    }
                    // Reset camera
                    camera.position.copy(CAMERA_SETTINGS.position)
                    camera.lookAt(CAMERA_SETTINGS.target)
                    controls.reset()

                    // Remove pinch handlers
                    containerRef.current?.removeEventListener('touchstart', handleTouchStart as any)
                    containerRef.current?.removeEventListener('touchmove', handleTouchMove as any)
                })

                // AR Started
                setIsARActive(true)
                isARSessionActiveRef.current = true
                scene.background = null

                // Initial AR Placement
                // Rotate 180° on X-axis to flip right-side up (gallery uses inverted camera)
                if (contentGroupRef.current) {
                    contentGroupRef.current.position.set(0, 0, -2) // 2 meters in front
                    contentGroupRef.current.scale.setScalar(0.5)
                    contentGroupRef.current.rotation.set(Math.PI, 0, 0) // Flip 180° on X
                }

                // Add pinch-to-zoom handlers
                containerRef.current?.addEventListener('touchstart', handleTouchStart as any, { passive: false })
                containerRef.current?.addEventListener('touchmove', handleTouchMove as any, { passive: false })

            } catch (e) {
                console.error("Failed to start AR", e)
            }
        }

        // Pinch-to-zoom state
        let lastPinchDistance = 0

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX
                const dy = e.touches[0].clientY - e.touches[1].clientY
                lastPinchDistance = Math.sqrt(dx * dx + dy * dy)
            }
        }

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && contentGroupRef.current && isARSessionActiveRef.current) {
                e.preventDefault()
                const dx = e.touches[0].clientX - e.touches[1].clientX
                const dy = e.touches[0].clientY - e.touches[1].clientY
                const distance = Math.sqrt(dx * dx + dy * dy)

                if (lastPinchDistance > 0) {
                    const scaleFactor = distance / lastPinchDistance
                    const currentScale = contentGroupRef.current.scale.x
                    const newScale = Math.max(0.1, Math.min(3, currentScale * scaleFactor))
                    contentGroupRef.current.scale.setScalar(newScale)
                }
                lastPinchDistance = distance
            }
        }

        setEnterAR(startAR)

        // Load splat
        const opts: any = { url: currentSplat }
        const fileType = getFileType(currentSplat)
        if (fileType) opts.fileType = fileType

        // Reveal effect and pointcloud toggle - setup animation timing
        // If minimal (clean mode), skip animation (start at 100s)
        const startT = isMinimal ? 100 : 0
        const animateT = dyno.dynoFloat(startT)
        animateTimeRef.current = animateT
        loadStartTimeRef.current = isMinimal ? 0 : performance.now()

        // Pointcloud mode toggle (reactive dynoFloat)
        const isPointcloudDyno = dyno.dynoFloat(0)
        isPointcloudRef.current = isPointcloudDyno

        // Setup magic shader after load via onLoad callback
        opts.onLoad = (loadedSplat: SplatMesh) => {
            loadedSplat.objectModifier = dyno.dynoBlock(
                { gsplat: dyno.Gsplat },
                { gsplat: dyno.Gsplat },
                ({ gsplat }: any) => {
                    const d = new dyno.Dyno({
                        inTypes: { gsplat: dyno.Gsplat, t: 'float', isPointcloud: 'float' },
                        outTypes: { gsplat: dyno.Gsplat },
                        globals: () => [
                            dyno.unindent(`
                                vec3 hash(vec3 p) {
                                    p = fract(p * 0.3183099 + 0.1);
                                    p *= 17.0;
                                    return fract(vec3(p.x * p.y * p.z, p.x + p.y * p.z, p.x * p.y + p.z));
                                }
                                vec3 noise(vec3 p) {
                                    vec3 i = floor(p);
                                    vec3 f = fract(p);
                                    f = f * f * (3.0 - 2.0 * f);
                                    vec3 n000 = hash(i + vec3(0,0,0));
                                    vec3 n100 = hash(i + vec3(1,0,0));
                                    vec3 n010 = hash(i + vec3(0,1,0));
                                    vec3 n110 = hash(i + vec3(1,1,0));
                                    vec3 n001 = hash(i + vec3(0,0,1));
                                    vec3 n101 = hash(i + vec3(1,0,1));
                                    vec3 n011 = hash(i + vec3(0,1,1));
                                    vec3 n111 = hash(i + vec3(1,1,1));
                                    vec3 x0 = mix(n000, n100, f.x);
                                    vec3 x1 = mix(n010, n110, f.x);
                                    vec3 x2 = mix(n001, n101, f.x);
                                    vec3 x3 = mix(n011, n111, f.x);
                                    vec3 y0 = mix(x0, x1, f.y);
                                    vec3 y1 = mix(x2, x3, f.y);
                                    return mix(y0, y1, f.z);
                                }
                            `)
                        ],
                        statements: ({ inputs, outputs }: any) => dyno.unindentLines(`
                            ${outputs.gsplat} = ${inputs.gsplat};
                            float t = ${inputs.t};
                            float isPointcloud = ${inputs.isPointcloud};
                            vec3 scales = ${inputs.gsplat}.scales;
                            vec3 localPos = ${inputs.gsplat}.center;
                            float l = length(localPos.xz);
                            
                            // Smoother Reveal Effect - Fast wave from center
                            float progress = smoothstep(0.0, 1.0, clamp(t * 1.0, 0.0, 1.0));
                            
                            // Scale up from 0 - wave spreads outward quickly
                            float scaleReveal = smoothstep(0.0, 1.0, clamp(t * 3.0 - l * 0.1, 0.0, 1.0));
                            
                            ${outputs.gsplat}.scales = scales * scaleReveal;
                            
                            // Pointcloud mode: tiny opaque dots
                            if (isPointcloud > 0.5) {
                                ${outputs.gsplat}.scales = vec3(0.003);
                                ${outputs.gsplat}.rgba.a = 1.0;
                            }
                        `)
                    })
                    gsplat = d.apply({ gsplat, t: animateT, isPointcloud: isPointcloudDyno }).gsplat
                    return { gsplat }
                }
            )
            loadedSplat.updateGenerator()

            // Signal loaded
            if (isMinimal) {
                // Ensure frame render happened
                requestAnimationFrame(() => {
                    window.isSplatLoaded = true;
                });
            } else {
                window.isSplatLoaded = true;
            }
        }

        const splat = new SplatMesh(opts)
        contentGroup.add(splat)
        splatRef.current = splat

        // Add keyboard event listeners
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        // Animation Loop
        renderer.setAnimationLoop(() => {
            // Only use custom flight and orbital controls if NOT in AR
            if (!renderer.xr.isPresenting) {
                applyFlyMovement()
                controls.update()
            }

            // Update magic reveal animation (only if not minimal/clean)
            if (!isMinimal && animateTimeRef.current && loadStartTimeRef.current > 0) {
                const elapsed = (performance.now() - loadStartTimeRef.current) / 1000
                animateTimeRef.current.value = Math.min(elapsed, 20)
                if (splatRef.current) splatRef.current.updateVersion()
            }


            renderer.render(scene, camera)
        })

        // Resize handler
        const handleResize = () => {
            if (!containerRef.current || !camera || !renderer) return
            camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight
            camera.updateProjectionMatrix()
            renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
        }
        window.addEventListener('resize', handleResize)

        // Cleanup function updates
        return () => {
            window.isSplatLoaded = false;
            window.removeEventListener('resize', handleResize)
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
            renderer.setAnimationLoop(null) // Stop loop

            if (splatRef.current) splatRef.current.dispose()
            if (rendererRef.current && containerRef.current) {
                try { containerRef.current.removeChild(rendererRef.current.domElement) } catch { }
                rendererRef.current.dispose()
            }
            if (controlsRef.current) controlsRef.current.dispose()
            // Cleanup AR starter
            setEnterAR(async () => { })
        }
    }, [currentSplat, currentSplatFormat, enableXR, handleKeyDown, handleKeyUp, applyFlyMovement])

    if (!currentSplat) return null

    return (
        <div className="relative w-full h-full">
            <div
                ref={containerRef}
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
            />

            {/* Controls hint */}
            {!isMinimal && (
                <div className="absolute bottom-2 left-2 text-everforest-fg/30 text-xs shadow-black/50 drop-shadow-md pointer-events-none">
                    WASD: Fly • Q/E: Up/Down • Space: Pointcloud • Mouse: Orbit
                </div>
            )}

            {/* Action Buttons (Right Side) - Only show when API is available */}
            {!isMinimal && !isStatic && currentSplatId && !enableXR && (
                <div className="absolute top-1/2 right-4 -translate-y-1/2 flex flex-col gap-4 pointer-events-auto z-50">
                    <button
                        onClick={handleSaveView}
                        disabled={isSaving}
                        className={`p-3 rounded-full backdrop-blur-md transition-all shadow-lg ${saveStatus === 'success' ? 'bg-everforest-green text-everforest-bg-hard' :
                            saveStatus === 'error' ? 'bg-everforest-red text-everforest-bg-hard' :
                                'bg-everforest-bg-medium/50 text-everforest-fg hover:bg-everforest-bg-soft'
                            }`}
                        title="Set as Default View"
                    >
                        {saveStatus === 'success' ? <CheckCircle2 size={24} /> :
                            saveStatus === 'error' ? <AlertCircle size={24} /> :
                                <Camera size={24} />}
                    </button>

                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="p-3 rounded-full backdrop-blur-md bg-everforest-bg-medium/50 text-everforest-red hover:bg-everforest-red/20 transition-all shadow-lg"
                        title="Delete Splat"
                    >
                        {isDeleting ? <div className="w-6 h-6 border-2 border-everforest-red border-t-transparent rounded-full animate-spin" /> : <Trash2 size={24} />}
                    </button>
                </div>
            )}
        </div>
    )
}
