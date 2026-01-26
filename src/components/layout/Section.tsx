'use client';

import { motion } from 'motion/react';
import { fadeInUp, lineReveal, viewportSettings } from '@/lib/animations';

interface SectionProps {
  id?: string;
  title?: string;
  subtitle?: string;
  label?: string;
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export default function Section({
  id,
  title,
  subtitle,
  label,
  children,
  className = '',
  fullWidth = false,
}: SectionProps) {
  return (
    <section
      id={id}
      className={`relative py-32 ${className}`}
    >
      <div className={fullWidth ? 'px-6 lg:px-12' : 'max-w-7xl mx-auto px-6 lg:px-12'}>
        {(title || subtitle || label) && (
          <motion.div
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={viewportSettings}
            className="mb-20"
          >
            {label && (
              <div className="flex items-center gap-4 mb-6">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#00F0FF]">
                  {label}
                </span>
                <motion.div
                  className="h-px bg-[#00F0FF]/30 flex-grow max-w-[100px]"
                  variants={lineReveal}
                  initial="initial"
                  whileInView="animate"
                  viewport={viewportSettings}
                />
              </div>
            )}
            {title && (
              <h2 className="font-display text-5xl md:text-6xl lg:text-7xl text-[#FAFAFA] mb-6 leading-[1.1]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-lg md:text-xl text-[#888888] max-w-2xl leading-relaxed">
                {subtitle}
              </p>
            )}
          </motion.div>
        )}
        {children}
      </div>
    </section>
  );
}
