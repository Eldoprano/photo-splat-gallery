import { create } from 'zustand'

interface TransitionState {
    isTransitioning: boolean
    thumbnailRect: { x: number; y: number; width: number; height: number } | null
    thumbnailUrl: string | null
}

interface AppState {
    viewMode: 'gallery' | 'viewer' | 'drop'
    currentSplat: string | null
    currentSplatId: string | null
    currentSplatFormat: 'ply' | 'splat' | null  // File format for dropped files
    isPointCloud: boolean
    transition: TransitionState
    setViewMode: (mode: 'gallery' | 'viewer' | 'drop') => void
    setCurrentSplat: (url: string | null, id?: string | null, format?: 'ply' | 'splat' | null) => void
    setIsPointCloud: (isPoint: boolean) => void
    startTransition: (rect: TransitionState['thumbnailRect'], thumbUrl: string) => void
    endTransition: () => void
}

export const useStore = create<AppState>((set) => ({
    viewMode: 'gallery',
    currentSplat: null,
    currentSplatId: null,
    currentSplatFormat: null,
    isPointCloud: false,
    transition: {
        isTransitioning: false,
        thumbnailRect: null,
        thumbnailUrl: null,
    },
    setViewMode: (mode) => set({ viewMode: mode }),
    setCurrentSplat: (url, id = null, format = null) => set({
        currentSplat: url,
        currentSplatId: id,
        currentSplatFormat: format,
    }),
    setIsPointCloud: (isPoint) => set({ isPointCloud: isPoint }),
    startTransition: (rect, thumbUrl) => set({
        transition: {
            isTransitioning: true,
            thumbnailRect: rect,
            thumbnailUrl: thumbUrl,
        }
    }),
    endTransition: () => set({
        transition: {
            isTransitioning: false,
            thumbnailRect: null,
            thumbnailUrl: null,
        }
    }),
}))
