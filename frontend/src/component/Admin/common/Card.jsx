// src/components/Admin/common/Card.jsx
import React from 'react';
import { motion } from 'framer-motion';

const Card = ({
  children,
  className = '',
  onClick,
  hoverable = false,
  padding = 'lg',
  bordered = false,
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
    xl: 'p-8',
  };

  return (
    <motion.div
      onClick={onClick}
      whileHover={hoverable ? { y: -4, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)" } : {}}
      className={`
        bg-white rounded-2xl shadow-sm
        ${paddingClasses[padding]}
        ${bordered ? 'border border-gray-100' : ''}
        ${hoverable ? 'transition-colors cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
};

export default Card;