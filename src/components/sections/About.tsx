'use client';

import { motion } from 'motion/react';
import Section from '@/components/layout/Section';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { aboutTagline, aboutHighlights, currentProjects, technicalExpertise, focusAreas } from '@/lib/data';
import { fadeInUp, staggerContainer, viewportSettings } from '@/lib/animations';

export default function About() {
  return (
    <Section
      id="about"
      title="About"
      subtitle={aboutTagline}
      dark={false}
    >
      <motion.div
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={viewportSettings}
        className="space-y-12"
      >
        {/* Highlights Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {aboutHighlights.map((highlight, index) => (
            <motion.div key={index} variants={fadeInUp}>
              <Card hover={false} className="text-center">
                <div className="text-4xl font-bold text-gradient mb-2">
                  {highlight.stat}
                </div>
                <div className="text-white font-semibold mb-1">
                  {highlight.label}
                </div>
                <div className="text-[#71717a] text-sm">
                  {highlight.description}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Current Projects */}
        <motion.div variants={fadeInUp}>
          <Card hover={false}>
            <h3 className="text-lg font-semibold text-white mb-4">Current Projects</h3>
            <ul className="space-y-3">
              {currentProjects.map((project) => (
                <li key={project.name} className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-white rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <span className="text-white font-medium">{project.name}</span>
                    <span className="text-[#71717a]"> - {project.description}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>

        {/* Technical Expertise */}
        <motion.div variants={fadeInUp}>
          <Card hover={false}>
            <h3 className="text-lg font-semibold text-white mb-4">Technical Expertise</h3>
            <ul className="space-y-3">
              {technicalExpertise.map((skill) => (
                <li key={skill} className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-white rounded-full mt-2 mr-3 flex-shrink-0" />
                  <span className="text-[#a1a1aa]">{skill}</span>
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>

        {/* Focus Areas */}
        <motion.div variants={fadeInUp}>
          <Card hover={false}>
            <h3 className="text-lg font-semibold text-white mb-4">Focus Areas</h3>
            <div className="flex flex-wrap gap-2">
              {focusAreas.map((area) => (
                <Badge key={area} variant="outline">{area}</Badge>
              ))}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </Section>
  );
}
