'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import Section from '@/components/layout/Section';
import Badge from '@/components/ui/Badge';
import { aboutTagline, aboutHighlights, currentProjects, technicalExpertise, focusAreas } from '@/lib/data';
import { fadeInUp, staggerContainer, staggerContainerFast, viewportSettings } from '@/lib/animations';

export default function About() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const glowY = useTransform(scrollYProgress, [0, 1], [80, -80]);

  return (
    <Section
      id="about"
      label="02"
      title="About"
      subtitle={aboutTagline}
      className="bg-[#0C0C0C]"
    >
      <div ref={sectionRef} className="relative">
        {/* Parallax background radial glow */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ y: glowY }}
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-[0.07]"
            style={{
              background: 'radial-gradient(circle, rgba(0, 240, 255, 0.3) 0%, transparent 70%)',
            }}
          />
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={viewportSettings}
          className="relative space-y-16"
        >
          {/* Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {aboutHighlights.map((highlight, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="relative border border-[#1F1F1F] bg-[#0C0C0C] p-8 group hover:border-[#2A2A2A] transition-colors duration-500 card-breathe"
              >
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-[#00F0FF]/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="text-5xl md:text-6xl font-display text-[#00F0FF] mb-4">
                  {highlight.stat}
                </div>
                <div className="text-sm font-mono uppercase tracking-wider text-[#FAFAFA] mb-2">
                  {highlight.label}
                </div>
                <div className="text-sm text-[#555555]">
                  {highlight.description}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Two column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Current Projects */}
            <motion.div
              variants={fadeInUp}
              className="border border-[#1F1F1F] bg-[#0C0C0C] p-8"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-2 h-2 bg-[#FFB800]" />
                <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-[#888888]">
                  Current Projects
                </h3>
              </div>

              <motion.ul
                variants={staggerContainerFast}
                initial="initial"
                whileInView="animate"
                viewport={viewportSettings}
                className="space-y-5"
              >
                {currentProjects.map((project) => (
                  <motion.li
                    key={project.name}
                    variants={fadeInUp}
                    className="group"
                  >
                    <div className="flex items-baseline gap-4">
                      <span className="font-display text-2xl text-[#FAFAFA] group-hover:text-[#00F0FF] transition-colors duration-300">
                        {project.name}
                      </span>
                      <span className="text-sm text-[#555555] flex-grow border-b border-dashed border-[#2A2A2A]" />
                    </div>
                    <p className="text-sm text-[#555555] mt-1 pl-0">
                      {project.description}
                    </p>
                  </motion.li>
                ))}
              </motion.ul>
            </motion.div>

            {/* Technical Expertise */}
            <motion.div
              variants={fadeInUp}
              className="border border-[#1F1F1F] bg-[#0C0C0C] p-8"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-2 h-2 bg-[#00F0FF]" />
                <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-[#888888]">
                  Technical Expertise
                </h3>
              </div>

              <motion.ul
                variants={staggerContainerFast}
                initial="initial"
                whileInView="animate"
                viewport={viewportSettings}
                className="space-y-4"
              >
                {technicalExpertise.map((skill, index) => (
                  <motion.li
                    key={skill}
                    variants={fadeInUp}
                    className="flex items-center gap-4 group"
                  >
                    <span className="text-xs font-mono text-[#333333]">
                      0{index + 1}
                    </span>
                    <span className="text-[#888888] group-hover:text-[#FAFAFA] transition-colors duration-300">
                      {skill}
                    </span>
                  </motion.li>
                ))}
              </motion.ul>
            </motion.div>
          </div>

          {/* Focus Areas */}
          <motion.div
            variants={fadeInUp}
            className="border border-[#1F1F1F] bg-[#0C0C0C] p-8"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-2 bg-[#FF00AA]" />
              <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-[#888888]">
                Focus Areas
              </h3>
            </div>

            <div className="flex flex-wrap gap-3">
              {focusAreas.map((area) => (
                <Badge key={area} variant="outline" mono>
                  {area}
                </Badge>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </Section>
  );
}
