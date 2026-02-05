'use client';

import { motion } from 'motion/react';
import { Github, Linkedin, Twitter, ArrowUpRight } from 'lucide-react';
import { footerColumns, socialLinks } from '@/lib/data';
import { fadeInUp, staggerContainer, viewportSettings } from '@/lib/animations';

const socialIcons = {
  github: Github,
  linkedin: Linkedin,
  twitter: Twitter,
  mail: null,
};

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-[#050505] border-t border-[#1F1F1F]">
      {/* Decorative top line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00F0FF]/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={viewportSettings}
          className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16"
        >
          {footerColumns.map((column) => (
            <motion.div key={column.title} variants={fadeInUp}>
              <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-[#555555] mb-6">
                {column.title}
              </h3>
              <ul className="space-y-4">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className="inline-flex items-center gap-1 text-sm text-[#888888] hover:text-[#00F0FF] transition-colors duration-300 group"
                    >
                      {link.label}
                      {link.external && (
                        <ArrowUpRight
                          size={12}
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        {/* Divider */}
        <div className="border-t border-[#1F1F1F] pt-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Social Icons with spring hover + glow */}
            <div className="flex items-center gap-4">
              {socialLinks
                .filter((link) => socialIcons[link.icon])
                .map((link) => {
                  const Icon = socialIcons[link.icon];
                  return Icon ? (
                    <motion.a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 flex items-center justify-center border border-[#2A2A2A] text-[#555555] hover:border-[#00F0FF] hover:text-[#00F0FF] transition-all duration-300"
                      whileHover={{
                        y: -4,
                        scale: 1.1,
                        boxShadow: "0 0 20px rgba(0, 240, 255, 0.15)",
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      aria-label={link.label}
                    >
                      <Icon size={16} />
                    </motion.a>
                  ) : null;
                })}
            </div>

            {/* Copyright */}
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 bg-[#00F0FF] animate-pulse" />
              <p className="text-sm font-mono text-[#555555]">
                &copy; {currentYear} Arav Jain
              </p>
            </div>
          </div>
        </div>

        {/* Large decorative text */}
        <motion.div
          className="mt-20 pb-2"
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={viewportSettings}
        >
          <div className="font-display text-[8vw] md:text-[6vw] text-[#1F1F1F] leading-[0.95] tracking-tight select-none">
            Building the future.
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
