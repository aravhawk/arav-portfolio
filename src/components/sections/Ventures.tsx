'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import Section from '@/components/layout/Section';
import VentureCard from '@/components/cards/VentureCard';
import { ventures } from '@/lib/data';
import { staggerContainer, fadeInUp, viewportSettings } from '@/lib/animations';

export default function Ventures() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const lineY = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const lineOpacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  return (
    <Section
      id="ventures"
      label="01"
      title="Ventures"
      subtitle="Building the infrastructure for next-generation AI and blockchain systems."
      className="bg-[#050505]"
    >
      <div ref={sectionRef}>
        {/* Decorative line with parallax */}
        <motion.div
          className="absolute left-12 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#1F1F1F] to-transparent hidden lg:block"
          style={{ y: lineY, opacity: lineOpacity }}
        />

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={viewportSettings}
          className="space-y-8"
        >
          {ventures.map((venture, index) => (
            <VentureCard key={venture.id} venture={venture} index={index} />
          ))}
        </motion.div>

        {/* Bottom accent */}
        <motion.div
          className="mt-20 flex items-center gap-4"
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={viewportSettings}
        >
          <div className="w-2 h-2 bg-[#00F0FF]" />
          <p className="text-sm font-mono text-[#555555] uppercase tracking-wider">
            More ventures coming soon
          </p>
        </motion.div>
      </div>
    </Section>
  );
}
