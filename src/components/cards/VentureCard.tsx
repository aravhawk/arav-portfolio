'use client';

import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import type { Venture } from '@/types';
import { fadeInUp, cardHover } from '@/lib/animations';

interface VentureCardProps {
  venture: Venture;
  index: number;
}

export default function VentureCard({ venture, index }: VentureCardProps) {
  const isArchived = venture.stage === 'Archived';

  return (
    <motion.div variants={fadeInUp}>
      <motion.div
        variants={isArchived ? undefined : cardHover}
        initial={isArchived ? undefined : "rest"}
        whileHover={isArchived ? undefined : "hover"}
      >
        <a
          href={`https://${venture.website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group block"
        >
          <div className={`relative border bg-[#0C0C0C] p-8 md:p-10 transition-colors duration-500 overflow-hidden ${
            isArchived
              ? 'border-[#1A1A1A] opacity-60'
              : 'border-[#1F1F1F] hover:border-[#00F0FF]/30 hover:bg-[#0C0C0C]/80'
          }`}>
            {/* Hover gradient overlay — only for active */}
            {!isArchived && (
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.03) 0%, transparent 50%)',
                }}
              />
            )}

            {/* Index number */}
            <div className="absolute top-8 right-8 md:top-10 md:right-10">
              <span className="text-xs font-mono text-[#333333]">
                0{index + 1}
              </span>
            </div>

            {/* Corner accents on hover — only for active */}
            {!isArchived && (
              <>
                <motion.div
                  className="absolute top-0 left-0 border-t-2 border-l-2 border-[#00F0FF] opacity-0 group-hover:opacity-100"
                  initial={{ width: 0, height: 0 }}
                  whileHover={{ width: 24, height: 24 }}
                  transition={{ duration: 0.3, delay: 0 }}
                />
                <motion.div
                  className="absolute bottom-0 right-0 border-b-2 border-r-2 border-[#00F0FF] opacity-0 group-hover:opacity-100"
                  initial={{ width: 0, height: 0 }}
                  whileHover={{ width: 24, height: 24 }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                />
              </>
            )}

            <div className="relative flex flex-col lg:flex-row lg:items-start gap-8">
              {/* Logo */}
              <div className="flex-shrink-0">
                <div className={`w-16 h-16 md:w-20 md:h-20 flex items-center justify-center transition-transform duration-500 ${
                  isArchived
                    ? 'bg-[#2A2A2A]'
                    : 'bg-[#FAFAFA] group-hover:scale-105'
                }`}>
                  <span className={`text-2xl md:text-3xl font-display ${
                    isArchived ? 'text-[#555555]' : 'text-[#050505]'
                  }`}>
                    {venture.logo}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-grow">
                {/* Title row */}
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <h3 className={`font-display text-3xl md:text-4xl transition-colors duration-300 ${
                    isArchived
                      ? 'text-[#888888]'
                      : 'text-[#FAFAFA] group-hover:text-[#00F0FF]'
                  }`}>
                    {venture.name}
                  </h3>
                  <ArrowUpRight
                    size={24}
                    className={`transition-all duration-300 ${
                      isArchived
                        ? 'text-[#333333]'
                        : 'text-[#555555] group-hover:text-[#00F0FF] group-hover:translate-x-1 group-hover:-translate-y-1'
                    }`}
                  />
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-3 mb-6">
                  <Badge variant={isArchived ? 'outline' : 'cyan'}>{venture.industry}</Badge>
                  <Badge variant={isArchived ? 'outline' : 'amber'}>{venture.stage}</Badge>
                  <Badge variant="outline">Est. {venture.founded}</Badge>
                </div>

                {/* Description */}
                <p className={`text-lg leading-relaxed max-w-2xl mb-6 ${
                  isArchived ? 'text-[#555555]' : 'text-[#888888]'
                }`}>
                  {venture.description}
                </p>

                {/* Link */}
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-mono transition-colors duration-300 ${
                    isArchived
                      ? 'text-[#333333]'
                      : 'text-[#555555] group-hover:text-[#00F0FF]'
                  }`}>
                    {venture.website}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </a>
      </motion.div>
    </motion.div>
  );
}
