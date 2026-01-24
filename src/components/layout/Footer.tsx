'use client';

import { motion } from 'motion/react';
import { Github, Linkedin, Twitter } from 'lucide-react';
import { footerColumns, socialLinks } from '@/lib/data';
import { fadeInUp, staggerContainer, viewportSettings } from '@/lib/animations';

const socialIcons = {
  github: Github,
  linkedin: Linkedin,
  twitter: Twitter,
  mail: null
};

export default function Footer() {
  return (
    <footer className="bg-black border-t border-[#1a1a1a]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={viewportSettings}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12"
        >
          {footerColumns.map((column) => (
            <motion.div key={column.title} variants={fadeInUp}>
              <h3 className="text-sm font-semibold text-white mb-4">{column.title}</h3>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className="text-sm text-[#71717a] hover:text-white transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        {/* Divider */}
        <div className="border-t border-[#1a1a1a] pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Social Icons */}
            <div className="flex items-center gap-4">
              {socialLinks
                .filter((link) => socialIcons[link.icon])
                .map((link) => {
                  const Icon = socialIcons[link.icon];
                  return Icon ? (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#52525b] hover:text-white transition-colors duration-200"
                      aria-label={link.label}
                    >
                      <Icon size={20} />
                    </a>
                  ) : null;
                })}
            </div>

            {/* Copyright */}
            <p className="text-sm text-[#52525b]">
              &copy; {new Date().getFullYear()} Arav Jain. Building the future of AI infrastructure.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
