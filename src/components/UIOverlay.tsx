import { ArrowLeft, Box, Boxes, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { useState } from 'react'

const API_URL = 'http://localhost:3001'

export default function UIOverlay() {
    const { setViewMode, isPointCloud, setIsPointCloud, currentSplatId, setCurrentSplat } = useStore()
    const [isDeleting, setIsDeleting] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const handleDelete = async () => {
        if (!currentSplatId) return

        setIsDeleting(true)
        try {
            const res = await fetch(`${API_URL}/api/splats/${encodeURIComponent(currentSplatId)}`, {
                method: 'DELETE',
            })
            const data = await res.json()

            if (data.success) {
                // Go back to gallery after deletion
                setCurrentSplat(null)
                setViewMode('gallery')
                // Force reload to update the gallery
                window.location.reload()
            } else {
                alert('Failed to delete: ' + (data.errors?.join(', ') || 'Unknown error'))
            }
        } catch (err) {
            alert('Failed to delete. Make sure API server is running on port 3001.\n\nRun: node scripts/api-server.cjs')
        } finally {
            setIsDeleting(false)
            setShowConfirm(false)
        }
    }

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
                        onClick={() => setShowConfirm(true)}
                        className="p-2 rounded-full backdrop-blur bg-everforest-bg-medium/50 text-everforest-fg hover:bg-red-500/50 hover:text-red-200 transition-colors"
                        title="Delete Splat"
                        disabled={isDeleting}
                    >
                        <Trash2 className="w-6 h-6" />
                    </button>
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

            {/* Delete Confirmation Modal */}
            {showConfirm && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-everforest-bg-medium p-6 rounded-xl shadow-xl max-w-sm mx-4">
                        <h3 className="text-xl font-bold text-everforest-fg mb-2">Delete Splat?</h3>
                        <p className="text-everforest-fg/70 mb-4">
                            This will permanently delete <strong className="text-everforest-yellow">{currentSplatId}</strong> and its thumbnail.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="px-4 py-2 rounded-lg bg-everforest-bg-soft text-everforest-fg hover:bg-everforest-bg-hard transition-colors"
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
