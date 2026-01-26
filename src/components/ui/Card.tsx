'use client';

import { motion } from 'motion/react';
import { cardHover } from '@/lib/animations';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  variant?: 'default' | 'elevated' | 'bordered';
}

export default function Card({
  children,
  className = '',
  hover = true,
  glow = false,
  variant = 'default',
}: CardProps) {
  const variants = {
    default: 'bg-[#0C0C0C] border-[#1F1F1F]',
    elevated: 'bg-[#121212] border-[#2A2A2A]',
    bordered: 'bg-transparent border-[#2A2A2A]',
  };

  const baseStyles = `
    relative border p-8
    transition-all duration-500
  `;

  if (hover) {
    return (
      <motion.div
        className={`${baseStyles} ${variants[variant]} ${className}`}
        initial="rest"
        whileHover="hover"
        variants={cardHover}
      >
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#3A3A3A] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#3A3A3A] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[#3A3A3A] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-[#3A3A3A] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Glow effect */}
        {glow && (
          <div className="absolute inset-0 opacity-0 transition-opacity duration-500 hover:opacity-100">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00F0FF]/5 to-transparent" />
          </div>
        )}

        {children}
      </motion.div>
    );
  }

  return (
    <div className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}
