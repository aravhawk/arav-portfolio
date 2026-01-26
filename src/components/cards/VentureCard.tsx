'use client';

import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import type { Venture } from '@/types';
import { fadeInUp } from '@/lib/animations';

interface VentureCardProps {
  venture: Venture;
  index: number;
}

export default function VentureCard({ venture, index }: VentureCardProps) {
  return (
    <motion.div variants={fadeInUp}>
      <a
        href={`https://${venture.website}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group block"
      >
        <div className="relative border border-[#1F1F1F] bg-[#0C0C0C] p-8 md:p-10 transition-all duration-500 hover:border-[#00F0FF]/30 hover:bg-[#0C0C0C]/80">
          {/* Index number */}
          <div className="absolute top-8 right-8 md:top-10 md:right-10">
            <span className="text-xs font-mono text-[#333333]">
              0{index + 1}
            </span>
          </div>

          {/* Corner accents on hover */}
          <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#00F0FF] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#00F0FF] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <div className="flex flex-col lg:flex-row lg:items-start gap-8">
            {/* Logo */}
            <div className="flex-shrink-0">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-[#FAFAFA] flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
                <span className="text-2xl md:text-3xl font-display text-[#050505]">
                  {venture.logo}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-grow">
              {/* Title row */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <h3 className="font-display text-3xl md:text-4xl text-[#FAFAFA] group-hover:text-[#00F0FF] transition-colors duration-300">
                  {venture.name}
                </h3>
                <ArrowUpRight
                  size={24}
                  className="text-[#555555] transition-all duration-300 group-hover:text-[#00F0FF] group-hover:translate-x-1 group-hover:-translate-y-1"
                />
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-3 mb-6">
                <Badge variant="cyan">{venture.industry}</Badge>
                <Badge variant="amber">{venture.stage}</Badge>
                <Badge variant="outline">Est. {venture.founded}</Badge>
              </div>

              {/* Description */}
              <p className="text-[#888888] text-lg leading-relaxed max-w-2xl mb-6">
                {venture.description}
              </p>

              {/* Link */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-[#555555] group-hover:text-[#00F0FF] transition-colors duration-300">
                  {venture.website}
                </span>
              </div>
            </div>
          </div>
        </div>
      </a>
    </motion.div>
  );
}
