import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import { useStore } from './store'
import SplatViewer from './components/SplatViewer'
import Gallery from './components/Gallery'
import UIOverlay from './components/UIOverlay'
import ZoomTransition from './components/ZoomTransition'

function App() {
  const { viewMode, setViewMode, setCurrentSplat } = useStore()

  // Handle URL params for easy sharing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const splatParam = params.get('splat')

    if (splatParam) {
      setCurrentSplat(splatParam, 'deep-linked')
      setViewMode('viewer')
    }
  }, [setCurrentSplat, setViewMode])

  // ESC key to exit viewer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewMode === 'viewer') {
        setCurrentSplat(null)
        setViewMode('gallery')
        window.history.pushState({}, '', '/')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewMode, setCurrentSplat, setViewMode])

  return (
    <div className="w-screen h-screen bg-everforest-bg-hard text-everforest-fg relative overflow-hidden">
      <AnimatePresence mode="popLayout">
        {viewMode === 'gallery' ? (
          <Gallery key="gallery" />
        ) : viewMode === 'viewer' && (
          <motion.div
            key="viewer"
            className="w-full h-full relative z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <SplatViewer />
            <UIOverlay />
          </motion.div>
        )}
      </AnimatePresence>

      <ZoomTransition />
    </div>
  )
}

export default App
