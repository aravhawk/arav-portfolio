'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
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
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [1.5, 0, -1.5]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.985, 1, 0.985]);

  return (
    <section
      ref={sectionRef}
      id={id}
      className={`relative py-32 ${className}`}
    >
      <motion.div
        style={{
          rotateX,
          scale,
          transformPerspective: 1200,
        }}
        className={fullWidth ? 'px-6 lg:px-12' : 'max-w-7xl mx-auto px-6 lg:px-12'}
      >
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
      </motion.div>
    </section>
  );
}
