'use client';

import { forwardRef, useState } from 'react';
import { motion } from 'motion/react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, id, className = '', ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-xs font-mono uppercase tracking-wider text-[#555555] mb-3"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={id}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={`
              w-full px-4 py-3
              bg-[#0C0C0C] border border-[#2A2A2A]
              text-[#FAFAFA] font-sans text-sm
              placeholder-[#555555]
              focus:outline-none focus:border-[#00F0FF]
              transition-colors duration-300
              ${className}
            `}
            {...props}
          />
          {/* Focus glow effect */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: isFocused ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            style={{
              boxShadow: '0 0 20px rgba(0, 240, 255, 0.1)',
            }}
          />
        </div>
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
