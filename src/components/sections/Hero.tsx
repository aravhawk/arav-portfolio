'use client';

import { motion } from 'motion/react';
import Button from '@/components/ui/Button';
import GridBackground from '@/components/ui/GridBackground';
import { fadeInUp, staggerContainer } from '@/lib/animations';

export default function Hero() {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative min-h-[92vh] flex items-center justify-center bg-black overflow-hidden">
      {/* Grid Background */}
      <GridBackground fade="both" vignette />

      {/* Radial gradient overlay for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, black 80%)'
        }}
      />

      {/* Content */}
      <div className="relative max-w-6xl mx-auto px-6 py-32">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="max-w-3xl"
        >
          {/* Name */}
          <motion.h1
            variants={fadeInUp}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 text-gradient"
          >
            Arav Jain
          </motion.h1>

          {/* Title */}
          <motion.p
            variants={fadeInUp}
            className="text-xl md:text-2xl text-[#a1a1aa] mb-6"
          >
            Founder & CEO of Infiniflop
          </motion.p>

          {/* Description */}
          <motion.p
            variants={fadeInUp}
            className="text-lg text-[#71717a] mb-10 max-w-2xl leading-relaxed"
          >
            Building the future of GPU compute infrastructure. Making AI accessible through pay-per-FLOP solutions.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Button
              variant="primary"
              size="lg"
              icon="arrow"
              onClick={() => scrollToSection('contact')}
            >
              Get in Touch
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => scrollToSection('ventures')}
            >
              View My Work
            </Button>
          </motion.div>
        </motion.div>
      </div>

    </section>
  );
}
