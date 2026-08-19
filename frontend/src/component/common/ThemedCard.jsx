// src/components/common/ThemedCard.jsx
import React from 'react';
import { useTheme } from '../../contexts/ThemeContexts';

const ThemedCard = ({ children, className = '', ...props }) => {
  const { colors } = useTheme();

  return (
    <div
      className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all ${className}`}
      style={{
        borderLeft: `4px solid ${colors.primary}`,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export default ThemedCard;