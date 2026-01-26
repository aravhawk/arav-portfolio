'use client';

import { motion } from 'motion/react';

interface GridBackgroundProps {
  className?: string;
  variant?: 'circuit' | 'dots' | 'lines';
  fade?: 'none' | 'top' | 'bottom' | 'both' | 'radial';
  animated?: boolean;
  intensity?: 'dim' | 'subtle' | 'visible';
}

export default function GridBackground({
  className = '',
  variant = 'circuit',
  fade = 'none',
  animated = false,
  intensity = 'dim',
}: GridBackgroundProps) {
  const opacityMap = {
    dim: 0.015,
    subtle: 0.03,
    visible: 0.05,
  };

  const opacity = opacityMap[intensity];

  const fadeStyles = {
    none: '',
    top: 'linear-gradient(to bottom, transparent, black 40%)',
    bottom: 'linear-gradient(to top, transparent, black 40%)',
    both: 'linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)',
    radial: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
  };

  const getPattern = () => {
    switch (variant) {
      case 'circuit':
        return {
          backgroundImage: `
            linear-gradient(90deg, rgba(255, 255, 255, ${opacity}) 1px, transparent 1px),
            linear-gradient(rgba(255, 255, 255, ${opacity}) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        };
      case 'dots':
        return {
          backgroundImage: `radial-gradient(circle, rgba(255, 255, 255, ${opacity * 2}) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        };
      case 'lines':
        return {
          backgroundImage: `linear-gradient(90deg, rgba(255, 255, 255, ${opacity}) 1px, transparent 1px)`,
          backgroundSize: '120px 120px',
        };
      default:
        return {};
    }
  };

  const maskImage = fade !== 'none' ? fadeStyles[fade] : undefined;
  const pattern = getPattern();

  const gridElement = (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        ...pattern,
        maskImage,
        WebkitMaskImage: maskImage,
      }}
    />
  );

  if (animated) {
    return (
      <motion.div
        className={`absolute inset-0 pointer-events-none ${className}`}
        style={{
          ...pattern,
          maskImage,
          WebkitMaskImage: maskImage,
        }}
        animate={{
          backgroundPosition: ['0px 0px', '80px 80px'],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    );
  }

  return gridElement;
}
