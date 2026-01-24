'use client';

import { motion } from 'motion/react';
import { fadeInUp, viewportSettings } from '@/lib/animations';

interface SectionProps {
  id?: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
}

export default function Section({
  id,
  title,
  subtitle,
  children,
  className = '',
  dark = true
}: SectionProps) {
  return (
    <section
      id={id}
      className={`py-24 ${dark ? 'bg-black' : 'bg-[#0a0a0a]'} ${className}`}
    >
      <div className="max-w-6xl mx-auto px-6">
        {(title || subtitle) && (
          <motion.div
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={viewportSettings}
            className="mb-16"
          >
            {title && (
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xl text-[#a1a1aa]">{subtitle}</p>
            )}
          </motion.div>
        )}
        {children}
      </div>
    </section>
  );
}
