'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import Button from '@/components/ui/Button';
import GridBackground from '@/components/ui/GridBackground';
import { fadeInUp, letterStagger, letterFadeIn, lineReveal, maskReveal } from '@/lib/animations';

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
            opacity: 0.2,
          }}
        />

        {/* Accent glow - bottom left - breathing */}
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] accent-glow-breathe"
          style={{
            background: 'radial-gradient(circle, rgba(255, 184, 0, 0.1) 0%, transparent 70%)',
            opacity: 0.15,
            animationDelay: '1.5s',
          }}
        />
      </div>

      {/* Hero scan line effect */}
      <div
        className="absolute inset-0 pointer-events-none z-10 hero-scan-line"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(0, 240, 255, 0.08) 45%, rgba(0, 240, 255, 0.15) 50%, rgba(0, 240, 255, 0.08) 55%, transparent 100%)',
          height: '6px',
          width: '100%',
        }}
      />

      {/* Floating decorative elements */}
      {/* Vertical line - ambient breathing */}
      <motion.div
        className="absolute top-[20%] right-[15%] w-px h-32 bg-gradient-to-b from-[#00F0FF]/50 to-transparent"
        style={{ y }}
        animate={{
          y: [0, -15, 0],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {/* Horizontal line - ambient pulse */}
      <motion.div
        className="absolute bottom-[30%] left-[10%] w-24 h-px bg-gradient-to-r from-transparent to-[#FFB800]/30"
        style={{ y }}
        animate={{
          scaleX: [1, 1.3, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Small rotating square - amber border */}
      <motion.div
        className="absolute top-[35%] right-[8%] w-4 h-4 border border-[#FFB800]/40 hidden md:block"
        animate={{
          rotate: 360,
          scale: [1, 1.1, 1],
        }}
        transition={{
          rotate: { duration: 20, repeat: Infinity, ease: "linear" },
          scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
        }}
      />

      {/* Additional vertical accent line - bottom right */}
      <motion.div
        className="absolute bottom-[15%] right-[20%] w-px h-20 bg-gradient-to-t from-[#00F0FF]/30 to-transparent hidden md:block"
        animate={{
          opacity: [0.2, 0.5, 0.2],
          scaleY: [1, 1.2, 1],
        }}
        transition={{
          duration: 5,
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

          {/* Name with clip-path reveal + character animation */}
          <motion.div
            variants={maskReveal}
            initial="initial"
            animate="animate"
            transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
          >
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
          </motion.div>

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
