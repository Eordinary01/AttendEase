// src/components/common/ThemedButton.jsx
import React from 'react';
import { useTheme } from '../../contexts/ThemeContexts';

const ThemedButton = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  ...props 
}) => {
  const { colors } = useTheme();
  
  const variantStyles = {
    primary: {
      bg: colors.primary,
      hover: adjustColor(colors.primary, -20),
    },
    secondary: {
      bg: colors.secondary,
      hover: adjustColor(colors.secondary, -20),
    },
    outline: {
      bg: 'transparent',
      hover: colors.primary,
      border: colors.primary,
    },
  };

  const style = variantStyles[variant];

  return (
    <button
      className={`px-4 py-2 rounded-lg font-medium text-white transition-all hover:shadow-lg ${className}`}
      style={{
        backgroundColor: style.bg,
        borderColor: variant === 'outline' ? style.border : 'transparent',
        borderWidth: variant === 'outline' ? '2px' : '0',
        color: variant === 'outline' ? style.border : 'white',
      }}
      onMouseEnter={(e) => {
        if (variant === 'outline') {
          e.currentTarget.style.backgroundColor = style.hover;
          e.currentTarget.style.color = 'white';
        } else {
          e.currentTarget.style.backgroundColor = style.hover;
        }
      }}
      onMouseLeave={(e) => {
        if (variant === 'outline') {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = style.border;
        } else {
          e.currentTarget.style.backgroundColor = style.bg;
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
};

// Helper function (same as in ThemeContext)
const adjustColor = (hex, percent) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
};

export default ThemedButton;