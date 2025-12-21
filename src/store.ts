import { create } from 'zustand'

interface TransitionState {
    isTransitioning: boolean
    thumbnailRect: { x: number; y: number; width: number; height: number } | null
    thumbnailUrl: string | null
}

interface AppState {
    viewMode: 'gallery' | 'viewer' | 'drop' | 'compare' | 'ingest'
    currentSplat: string | null
    currentSplatId: string | null
    currentSplatFormat: 'ply' | 'splat' | null  // File format for dropped files
    isPointCloud: boolean
    isStatic: boolean
    transition: TransitionState
    setViewMode: (mode: 'gallery' | 'viewer' | 'drop' | 'compare' | 'ingest') => void
    setCurrentSplat: (url: string | null, id?: string | null, format?: 'ply' | 'splat' | null) => void
    setIsPointCloud: (isPoint: boolean) => void
    setIsStatic: (isStatic: boolean) => void
    startTransition: (rect: TransitionState['thumbnailRect'], thumbUrl: string) => void
    endTransition: () => void
    // AR
    isARActive: boolean
    enterAR: () => Promise<void>
    setEnterAR: (fn: () => Promise<void>) => void
    setIsARActive: (active: boolean) => void
}

export const useStore = create<AppState>((set) => ({
    viewMode: 'gallery',
    currentSplat: null,
    currentSplatId: null,
    currentSplatFormat: null,
    isPointCloud: false,
    isStatic: true,
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
    setIsStatic: (isStatic) => set({ isStatic }),
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
    isARActive: false,
    enterAR: async () => { }, // Placeholder
    setEnterAR: (fn) => set({ enterAR: fn }),
    setIsARActive: (active) => set({ isARActive: active }),
}))
