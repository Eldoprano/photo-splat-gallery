import { ArrowLeft, Box, Boxes } from 'lucide-react'
import { useStore } from '../store'

export default function UIOverlay() {
    const { setViewMode, isPointCloud, setIsPointCloud, setCurrentSplat } = useStore()

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
                    <button
                        onClick={() => setIsPointCloud(!isPointCloud)}
                        className={`p-2 rounded-full backdrop-blur transition-colors ${isPointCloud
                            ? 'bg-everforest-green text-everforest-bg-hard'
                            : 'bg-everforest-bg-medium/50 text-everforest-fg hover:bg-everforest-bg-soft'
                            }`}
                        title="Toggle Pointcloud Mode"
                    >
                        {isPointCloud ? <Boxes className="w-6 h-6" /> : <Box className="w-6 h-6" />}
                    </button>
                </div>
            </div>
        </>
    )
}
