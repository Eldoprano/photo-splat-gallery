import { useState, useEffect, useCallback } from 'react'

interface OrientationData {
    alpha: number | null  // Compass direction (0-360)
    beta: number | null   // Front-back tilt (-180 to 180)
    gamma: number | null  // Left-right tilt (-90 to 90)
}

interface UseDeviceOrientationReturn {
    orientation: OrientationData
    isSupported: boolean
    hasPermission: boolean | null  // null = not yet requested
    isMobile: boolean
    requestPermission: () => Promise<boolean>
    error: string | null
}

// Check if device is mobile
function isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

// Check if we're on iOS (requires permission request)
function isIOSDevice(): boolean {
    if (typeof window === 'undefined') return false
    return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

// Check if we're on Android
export function isAndroidDevice(): boolean {
    if (typeof window === 'undefined') return false
    return /Android/i.test(navigator.userAgent)
}

export function useDeviceOrientation(): UseDeviceOrientationReturn {
    const [orientation, setOrientation] = useState<OrientationData>({
        alpha: null,
        beta: null,
        gamma: null,
    })
    const [isSupported, setIsSupported] = useState(false)
    const [hasPermission, setHasPermission] = useState<boolean | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isMobile] = useState(() => isMobileDevice())

    // Check if DeviceOrientationEvent is supported
    useEffect(() => {
        if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
            setIsSupported(true)
            // On Android, permission is typically granted automatically
            if (!isIOSDevice()) {
                setHasPermission(true)
            }
        }
    }, [])

    // Handle orientation changes
    const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
        setOrientation({
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma,
        })
    }, [])

    // Request permission (required for iOS 13+)
    const requestPermission = useCallback(async (): Promise<boolean> => {
        if (!isSupported) {
            setError('Device orientation not supported')
            return false
        }

        // iOS 13+ requires explicit permission request
        if (isIOSDevice() && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
            try {
                const permission = await (DeviceOrientationEvent as any).requestPermission()
                if (permission === 'granted') {
                    setHasPermission(true)
                    setError(null)
                    return true
                } else {
                    setHasPermission(false)
                    setError('Permission denied')
                    return false
                }
            } catch (err) {
                setError('Failed to request permission')
                setHasPermission(false)
                return false
            }
        }

        // Android and older iOS - permission granted by default
        setHasPermission(true)
        setError(null)
        return true
    }, [isSupported])

    // Set up event listener when permission is granted
    useEffect(() => {
        if (!isSupported || !hasPermission) return

        window.addEventListener('deviceorientation', handleOrientation, true)

        return () => {
            window.removeEventListener('deviceorientation', handleOrientation, true)
        }
    }, [isSupported, hasPermission, handleOrientation])

    return {
        orientation,
        isSupported,
        hasPermission,
        isMobile,
        requestPermission,
        error,
    }
}
