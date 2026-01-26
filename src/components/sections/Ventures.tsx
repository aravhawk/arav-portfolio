'use client';

import { motion } from 'motion/react';
import Section from '@/components/layout/Section';
import VentureCard from '@/components/cards/VentureCard';
import { ventures } from '@/lib/data';
import { staggerContainer, fadeInUp, viewportSettings } from '@/lib/animations';

export default function Ventures() {
  return (
    <Section
      id="ventures"
      label="01"
      title="Ventures"
      subtitle="Building the infrastructure for next-generation AI and blockchain systems."
      className="bg-[#050505]"
    >
      {/* Decorative line */}
      <motion.div
        className="absolute left-12 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#1F1F1F] to-transparent hidden lg:block"
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2 }}
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
    </Section>
  );
}
