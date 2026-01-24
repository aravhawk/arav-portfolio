'use client';

type BadgeVariant = 'default' | 'success' | 'info' | 'outline';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[#1a1a1a] text-[#a1a1aa] border-[#262626]',
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  outline: 'bg-transparent text-[#a1a1aa] border-[#333]'
};

export default function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
