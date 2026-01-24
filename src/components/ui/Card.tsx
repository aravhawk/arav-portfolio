'use client';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export default function Card({ children, className = '', hover = true }: CardProps) {
  const hoverStyles = hover
    ? 'hover:border-[#333] hover:bg-[#171717] card-glow'
    : '';

  return (
    <div
      className={`bg-[#111] border border-[#1a1a1a] rounded-xl p-8 transition-all duration-300 ${hoverStyles} ${className}`}
    >
      {children}
    </div>
  );
}
