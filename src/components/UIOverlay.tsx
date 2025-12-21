import { ArrowLeft, Box } from 'lucide-react'
import { useStore } from '../store'
import { useEffect, useState } from 'react'

export default function UIOverlay() {
    const { setViewMode, setCurrentSplat, enterAR, isARActive } = useStore()

    // Check for clean mode synchronously
    const isClean = new URLSearchParams(window.location.search).get('clean') === 'true'

    // Strict AR Support Check
    const [supportsAR, setSupportsAR] = useState(false)
    useEffect(() => {
        if ('xr' in navigator) {
            // @ts-ignore
            navigator.xr.isSessionSupported('immersive-ar')
                .then((supported: boolean) => setSupportsAR(supported))
                .catch(() => setSupportsAR(false))
        }
    }, [])

    if (isClean) return null

    return (
        <>
            <div className="absolute top-0 left-0 right-0 p-4 z-40 flex justify-between items-start pointer-events-none">
                <button
                    onClick={() => {
                        setCurrentSplat(null)
                        setViewMode('gallery')
                    }}
                    className="pointer-events-auto bg-everforest-bg-medium/50 backdrop-blur p-2 rounded-full hover:bg-everforest-bg-soft transition-colors group"
                    title="Back to Gallery (ESC)"
                >
                    <ArrowLeft className="w-6 h-6 text-everforest-fg group-hover:text-everforest-green" />
                </button>

                <div className="flex gap-2 pointer-events-auto">
                    {/* AR Mode Toggle - Only show if strictly supported */}
                    {supportsAR && (
                        <button
                            onClick={isARActive ? () => { /* Exit managed by X button usually or browser back */ } : enterAR}
                            className={`p-2 rounded-full backdrop-blur transition-colors ${isARActive
                                ? 'bg-red-500 text-white'
                                : 'bg-everforest-bg-medium/50 text-everforest-fg hover:bg-everforest-bg-soft'
                                }`}
                            title={isARActive ? "AR is Active" : "Start AR Experience"}
                        >
                            <Box className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>
        </>
    )
}
