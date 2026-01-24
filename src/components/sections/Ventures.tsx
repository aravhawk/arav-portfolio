'use client';

import { motion } from 'motion/react';
import Section from '@/components/layout/Section';
import VentureCard from '@/components/cards/VentureCard';
import { ventures } from '@/lib/data';
import { staggerContainer, viewportSettings } from '@/lib/animations';

export default function Ventures() {
  return (
    <Section
      id="ventures"
      title="Ventures"
      subtitle="Building the future of AI infrastructure"
    >
      <motion.div
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={viewportSettings}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {ventures.map((venture) => (
          <VentureCard key={venture.id} venture={venture} />
        ))}
      </motion.div>
    </Section>
  );
}
