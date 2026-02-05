'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import Button from '@/components/ui/Button';
import GridBackground from '@/components/ui/GridBackground';
import { staggerContainer, fadeInUp, letterStagger, letterFadeIn, lineReveal } from '@/lib/animations';

export default function Hero() {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const nameChars = "Arav Jain".split('');

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center bg-[#050505] overflow-hidden"
    >
      {/* Layered backgrounds */}
      <div className="absolute inset-0">
        {/* Circuit pattern */}
        <GridBackground variant="circuit" fade="radial" intensity="subtle" />

        {/* Radial gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 40%, transparent 0%, #050505 70%)',
          }}
        />

        {/* Accent glow - top right */}
        <div
          className="absolute top-0 right-0 w-[600px] h-[600px] opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(0, 240, 255, 0.15) 0%, transparent 70%)',
          }}
        />

        {/* Accent glow - bottom left */}
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(255, 184, 0, 0.1) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Floating decorative elements */}
      <motion.div
        className="absolute top-[20%] right-[15%] w-px h-32 bg-gradient-to-b from-[#00F0FF]/50 to-transparent"
        style={{ y }}
      />
      <motion.div
        className="absolute bottom-[30%] left-[10%] w-24 h-px bg-gradient-to-r from-transparent to-[#FFB800]/30"
        style={{ y }}
      />

      {/* Main content */}
      <motion.div
        className="relative max-w-7xl mx-auto px-6 lg:px-12 py-32"
        style={{ y, opacity }}
      >
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="max-w-4xl"
        >
          {/* Status indicator */}
          <motion.div
            variants={fadeInUp}
            className="flex items-center gap-3 mb-10"
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute w-3 h-3 bg-[#00F0FF] rounded-full animate-ping opacity-40" />
              <span className="relative w-2 h-2 bg-[#00F0FF] rounded-full" />
            </div>
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#888888]">
              Building the future of compute
            </span>
          </motion.div>

          {/* Name with character animation */}
          <motion.h1
            variants={letterStagger}
            initial="initial"
            animate="animate"
            className="font-display text-7xl sm:text-8xl md:text-9xl lg:text-[10rem] leading-[0.85] mb-8 tracking-tight"
          >
            {nameChars.map((char, index) => (
              <motion.span
                key={index}
                variants={letterFadeIn}
                className={char === ' ' ? 'inline-block w-6' : 'inline-block'}
                style={{
                  color: index < 4 ? '#FAFAFA' : '#00F0FF',
                }}
              >
                {char}
              </motion.span>
            ))}
          </motion.h1>

          {/* Title */}
          <motion.div
            variants={fadeInUp}
            className="flex items-center gap-4 mb-8"
          >
            <motion.div
              className="h-px bg-[#3A3A3A] w-16"
              variants={lineReveal}
            />
            <p className="text-lg md:text-xl font-mono text-[#888888]">
              Founder & CEO of <span className="text-[#FFB800]">Infiniflop</span>
            </p>
          </motion.div>

          {/* Description */}
          <motion.p
            variants={fadeInUp}
            className="text-lg md:text-xl text-[#555555] max-w-2xl leading-relaxed mb-12"
          >
            Building the future of GPU compute infrastructure.
            Making AI accessible through pay-per-FLOP solutions.
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
              View Ventures
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>

    </section>
  );
}
