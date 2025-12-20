import { motion } from 'framer-motion'
import { useStore } from '../store'
import { useEffect, useState, useRef } from 'react'

export default function ZoomTransition() {
    const { transition, viewMode, endTransition } = useStore()
    const [phase, setPhase] = useState<'idle' | 'zooming' | 'holding' | 'fading'>('idle')
    const animationRef = useRef<{ startX: number; startY: number; startScale: number } | null>(null)

    useEffect(() => {
        if (transition.isTransitioning && transition.thumbnailRect && viewMode === 'viewer') {
            // Calculate starting position - thumbnail center relative to screen center
            const { x, y, width, height } = transition.thumbnailRect
            const windowW = window.innerWidth
            const windowH = window.innerHeight

            // Calculate scale to match thumbnail size
            const scaleX = width / windowW
            const scaleY = height / windowH
            const startScale = Math.min(scaleX, scaleY) // Start at thumbnail size

            // Calculate offset to position at thumbnail center
            const thumbCenterX = x + width / 2
            const thumbCenterY = y + height / 2
            const startX = thumbCenterX - windowW / 2
            const startY = thumbCenterY - windowH / 2

            animationRef.current = { startX, startY, startScale }
            setPhase('zooming')

            // After zoom completes, hold then fade
            setTimeout(() => setPhase('holding'), 400)
            setTimeout(() => setPhase('fading'), 1200)
            setTimeout(() => {
                setPhase('idle')
                endTransition()
            }, 2000)
        }
    }, [transition.isTransitioning, transition.thumbnailRect, viewMode, endTransition])

    if (phase === 'idle' || !transition.thumbnailUrl || !animationRef.current) {
        return null
    }

    const { startX, startY, startScale } = animationRef.current

    const variants = {
        start: {
            x: startX,
            y: startY,
            scale: startScale,
            opacity: 1,
        },
        zoomed: {
            x: 0,
            y: 0,
            scale: 1,
            opacity: 1,
        },
        fading: {
            x: 0,
            y: 0,
            scale: 1.05, // Slight zoom while fading for effect
            opacity: 0,
        },
    }

    return (
        <motion.div
            className="fixed inset-0 z-30 pointer-events-none"
            style={{
                backgroundImage: `url(${transition.thumbnailUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                transformOrigin: 'center center',
            }}
            initial="start"
            animate={phase === 'fading' ? 'fading' : 'zoomed'}
            variants={variants}
            transition={{
                duration: phase === 'fading' ? 0.8 : 0.4,
                ease: [0.25, 0.1, 0.25, 1],
            }}
        />
    )
}
