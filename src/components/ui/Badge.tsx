'use client';

import { motion } from 'motion/react';

type BadgeVariant = 'default' | 'cyan' | 'amber' | 'outline' | 'success';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[#1A1A1A] text-[#888888] border-[#2A2A2A]',
  cyan: 'bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]/20',
  amber: 'bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/20',
  outline: 'bg-transparent text-[#888888] border-[#3A3A3A]',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export default function Badge({
  variant = 'default',
  children,
  className = '',
  mono = true,
}: BadgeProps) {
  return (
    <motion.span
      className={`
        inline-flex items-center px-3 py-1
        text-xs tracking-wider uppercase
        border transition-colors duration-300
        ${mono ? 'font-mono' : 'font-sans'}
        ${variantStyles[variant]}
        ${className}
      `}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.span>
  );
}
