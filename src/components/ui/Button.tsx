'use client';

import { forwardRef } from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: 'arrow' | 'external' | null;
  href?: string;
  external?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-white text-black hover:bg-gray-100 border-transparent',
  secondary: 'bg-transparent text-white border-[#333] hover:bg-white/5 hover:border-[#555]',
  ghost: 'bg-transparent text-white border-transparent hover:bg-white/5'
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg'
};

const iconSizes: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon = null, href, external, children, className = '', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed';

    const iconSize = iconSizes[size];
    const IconComponent = icon === 'arrow' ? ArrowRight : icon === 'external' ? ExternalLink : null;

    const classes = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

    if (href) {
      return (
        <a
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          className={classes}
        >
          {children}
          {IconComponent && <IconComponent className="ml-2" size={iconSize} />}
        </a>
      );
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
        {IconComponent && <IconComponent className="ml-2" size={iconSize} />}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
