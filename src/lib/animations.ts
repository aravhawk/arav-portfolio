import type { Variants } from 'motion/react';

// Easing curves - typed as tuples
const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];
const easeOutQuint: [number, number, number, number] = [0.22, 1, 0.36, 1];
const easeInOutCubic: [number, number, number, number] = [0.65, 0, 0.35, 1];

// Viewport settings for scroll-triggered animations
export const viewportSettings = {
  once: true,
  margin: '-100px' as const
};

// Fade in from bottom with blur materialize
export const fadeInUp: Variants = {
  initial: {
    opacity: 0,
    y: 40,
    filter: "blur(4px)",
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.8,
      ease: easeOutExpo,
    },
  },
};

// Simple fade
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: easeOutQuint,
    },
  },
};

// Fade in from left with blur
export const fadeInLeft: Variants = {
  initial: {
    opacity: 0,
    x: -40,
    filter: "blur(4px)",
  },
  animate: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.7,
      ease: easeOutExpo,
    },
  },
};

// Fade in from right with blur
export const fadeInRight: Variants = {
  initial: {
    opacity: 0,
    x: 40,
    filter: "blur(4px)",
  },
  animate: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.7,
      ease: easeOutExpo,
    },
  },
};

// Scale in with glow (for highlight cards)
export const scaleInGlow: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    filter: "blur(4px)",
  },
  animate: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.7,
      ease: easeOutQuint,
    },
  },
};

// Slide in from left with clip path reveal
export const slideRevealLeft: Variants = {
  initial: {
    opacity: 0,
    x: -60,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.9,
      ease: easeOutExpo,
    },
  },
};

// Slide in from right
export const slideRevealRight: Variants = {
  initial: {
    opacity: 0,
    x: 60,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.9,
      ease: easeOutExpo,
    },
  },
};

// Scale up with blur
export const scaleBlur: Variants = {
  initial: {
    opacity: 0,
    scale: 0.9,
    filter: "blur(10px)",
  },
  animate: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.7,
      ease: easeOutQuint,
    },
  },
};

// Stagger container
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

// Faster stagger for lists
export const staggerContainerFast: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

// Text character stagger
export const letterStagger: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.02,
    },
  },
};

export const letterFadeIn: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: easeOutQuint,
    },
  },
};

// Line reveal animation
export const lineReveal: Variants = {
  initial: {
    scaleX: 0,
    originX: 0,
  },
  animate: {
    scaleX: 1,
    transition: {
      duration: 1,
      ease: easeOutExpo,
    },
  },
};

// Mask reveal
export const maskReveal: Variants = {
  initial: {
    clipPath: "inset(0 100% 0 0)",
  },
  animate: {
    clipPath: "inset(0 0% 0 0)",
    transition: {
      duration: 0.8,
      ease: easeInOutCubic,
    },
  },
};

// Pulse scale
export const pulseScale: Variants = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.02, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// Navigation entrance
export const navEnter: Variants = {
  initial: {
    y: -100,
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.8,
      ease: easeOutExpo,
      delay: 0.2,
    },
  },
};

// Card hover lift - properly typed
export const cardHover: Variants = {
  rest: {
    y: 0,
    scale: 1,
    boxShadow: "0 0 0 rgba(0, 240, 255, 0)",
  },
  hover: {
    y: -10,
    scale: 1.01,
    boxShadow: "0 25px 50px rgba(0, 240, 255, 0.15)",
    transition: {
      duration: 0.3,
      ease: easeOutQuint,
    },
  },
};

// Page transition
export const pageTransition: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.5,
      when: "beforeChildren",
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.3,
    },
  },
};

// For backwards compatibility
export const scaleIn = scaleBlur;
export const slideInFromLeft = slideRevealLeft;
export const slideInFromRight = slideRevealRight;
