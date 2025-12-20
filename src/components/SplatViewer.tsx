import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d'

export default function SplatViewer() {
    const { currentSplat, currentSplatFormat } = useStore()
    const containerRef = useRef<HTMLDivElement>(null)
    const viewerRef = useRef<any>(null)

    useEffect(() => {
        if (!containerRef.current || !currentSplat) return

        // Clean up previous viewer if exists
        if (viewerRef.current) {
            viewerRef.current.dispose()
            viewerRef.current = null
        }

        // Create viewer with GaussianSplats3D
        // Camera moved forward (z=2) to be closer to splats
        const viewer = new GaussianSplats3D.Viewer({
            cameraUp: [0, -1, 0],
            initialCameraPosition: [0, 0.5, 2],  // Shifted down
            initialCameraLookAt: [0, 0.5, 10],  // Lower view
            rootElement: containerRef.current,
            sharedMemoryForWorkers: false,
        })

        viewerRef.current = viewer

        // Build scene options
        const sceneOptions: any = {
            splatAlphaRemovalThreshold: 5,
            showLoadingUI: true,
            progressiveLoad: true,
        }

        // If we have a format from dropped file, specify it
        // GaussianSplats3D uses SceneFormat enum: 0=Ply, 1=Splat, 2=Ksplat
        if (currentSplatFormat) {
            sceneOptions.format = currentSplatFormat === 'splat' ? 1 : 0
        }

        // Load the PLY file directly
        viewer.addSplatScene(currentSplat, sceneOptions)
            .then(() => {
                viewer.start()
            })
            .catch((error: Error) => {
                console.error('Failed to load splat:', error)
            })

        return () => {
            if (viewerRef.current) {
                viewerRef.current.dispose()
                viewerRef.current = null
            }
        }
    }, [currentSplat, currentSplatFormat])

    if (!currentSplat) return null

    return (
        <div
            ref={containerRef}
            className="w-full h-full bg-black"
            style={{ width: '100%', height: '100%' }}
        />
    )
}
