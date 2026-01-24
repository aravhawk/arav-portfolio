'use client';

import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import type { Venture } from '@/types';
import { fadeInUp } from '@/lib/animations';

interface VentureCardProps {
  venture: Venture;
}

export default function VentureCard({ venture }: VentureCardProps) {
  return (
    <motion.div variants={fadeInUp}>
      <Card className="group h-full">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="flex-shrink-0 w-12 h-12 bg-white text-black rounded-lg flex items-center justify-center text-xl font-bold">
            {venture.logo}
          </div>

          {/* Content */}
          <div className="flex-grow min-w-0">
            {/* Name */}
            <h3 className="text-xl font-bold text-white mb-3">{venture.name}</h3>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="default">{venture.industry}</Badge>
              <Badge variant="success">{venture.stage}</Badge>
              <Badge variant="info">Est. {venture.founded}</Badge>
            </div>

            {/* Description */}
            <p className="text-[#a1a1aa] mb-5 leading-relaxed">{venture.description}</p>

            {/* Link */}
            <a
              href={`https://${venture.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white font-medium hover:text-[#a1a1aa] transition-colors duration-200 group/link"
            >
              <span>{venture.website}</span>
              <ArrowUpRight
                size={16}
                className="transition-transform duration-200 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
              />
            </a>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
