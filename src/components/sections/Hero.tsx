'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import Button from '@/components/ui/Button';
import GridBackground from '@/components/ui/GridBackground';
import { fadeInUp, letterStagger, letterFadeIn, lineReveal } from '@/lib/animations';

// Hero-specific stagger with more dramatic timing
const heroStagger = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

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
        {/* Circuit pattern - animated */}
        <GridBackground variant="circuit" fade="radial" intensity="subtle" animated />

        {/* Radial gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 40%, transparent 0%, #050505 70%)',
          }}
        />

        {/* Accent glow - top right - breathing */}
        <div
          className="absolute top-0 right-0 w-[600px] h-[600px] accent-glow-breathe"
          style={{
            background: 'radial-gradient(circle, rgba(0, 240, 255, 0.15) 0%, transparent 70%)',
            opacity: 0.1,
          }}
        />

        {/* Accent glow - bottom left - breathing */}
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] accent-glow-breathe"
          style={{
            background: 'radial-gradient(circle, rgba(255, 184, 0, 0.1) 0%, transparent 70%)',
            opacity: 0.08,
            animationDelay: '1.5s',
          }}
        />
      </div>

      {/* Floating decorative elements */}
      {/* Vertical line - ambient breathing (toned down) */}
      <motion.div
        className="absolute top-[20%] right-[15%] w-px h-32 bg-gradient-to-b from-[#00F0FF]/25 to-transparent"
        style={{ y }}
        animate={{
          y: [0, -15, 0],
          opacity: [0.25, 0.4, 0.25],
        }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {/* Horizontal line - ambient pulse (toned down) */}
      <motion.div
        className="absolute bottom-[30%] left-[10%] w-24 h-px bg-gradient-to-r from-transparent to-[#FFB800]/15"
        style={{ y }}
        animate={{
          scaleX: [1, 1.3, 1],
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{
          duration: 7.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Main content */}
      <motion.div
        className="relative max-w-7xl mx-auto px-6 lg:px-12 py-32"
        style={{ y, opacity }}
      >
        <motion.div
          variants={heroStagger}
          initial="initial"
          animate="animate"
          className="max-w-4xl"
        >
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
              Co-Founder, <span className="text-[#FFB800]">Infiniflop Labs</span>
            </p>
          </motion.div>

          {/* Description */}
          <motion.p
            variants={fadeInUp}
            className="text-lg md:text-xl text-[#555555] max-w-2xl leading-relaxed mb-12"
          >
            Building AI agents that find issues in your apps before users do.
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
              View Work
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>

    </section>
  );
}
