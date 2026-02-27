import type { Spring, Transition } from 'framer-motion'
import { MOTION } from '@/config/constants'

const ease = [...MOTION.EASING] as [number, number, number, number]

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: MOTION.DURATION_NORMAL, ease } satisfies Transition,
}

export const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: { duration: MOTION.DURATION_MEDIUM, ease } satisfies Transition,
}

export const fadeInDown = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: MOTION.DURATION_NORMAL, ease } satisfies Transition,
}

export const slideInRight = {
  initial: { x: '100%', opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: '100%', opacity: 0 },
  transition: { duration: MOTION.DURATION_SLOW, ease } satisfies Transition,
}

export const slideInLeft = {
  initial: { x: '-100%', opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: '-100%', opacity: 0 },
  transition: { duration: MOTION.DURATION_SLOW, ease } satisfies Transition,
}

export const scaleIn = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.95, opacity: 0 },
  transition: { duration: MOTION.DURATION_FAST, ease } satisfies Transition,
}

export const expand = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: MOTION.DURATION_MEDIUM, ease } satisfies Transition,
}

export const collapse = {
  initial: { height: 'auto', opacity: 1 },
  animate: { height: 0, opacity: 0 },
  exit: { height: 'auto', opacity: 1 },
  transition: { duration: MOTION.DURATION_NORMAL, ease } satisfies Transition,
}

export const pulse = {
  animate: { opacity: [1, 0.5, 1] },
  transition: {
    duration: MOTION.DURATION_LOOP,
    repeat: MOTION.REPEAT_INFINITE,
    ease: MOTION.EASING_IN_OUT,
  } satisfies Transition,
}

export const shimmer = {
  animate: { backgroundPosition: ['200% 0', '-200% 0'] },
  transition: {
    duration: MOTION.DURATION_LOOP,
    repeat: MOTION.REPEAT_INFINITE,
    ease: MOTION.EASING_LINEAR,
  } satisfies Transition,
}

export const hoverPress = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.99 },
}

export const chevronSpin: Transition = {
  duration: MOTION.DURATION_FAST,
  ease,
}

export const springBounce: Spring = {
  type: 'spring',
  stiffness: MOTION.SPRING_STIFFNESS,
  damping: MOTION.SPRING_DAMPING,
}

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: MOTION.STAGGER_CHILDREN,
    },
  },
}
