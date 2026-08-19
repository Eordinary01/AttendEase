// src/components/Admin/ThemePreview.jsx
import React from 'react';
import { useTheme } from '../../contexts/ThemeContexts';

const ThemePreview = () => {
  const { colors } = useTheme();

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm">
      <h4 className="font-medium text-gray-900 mb-4">Live Preview</h4>
      <div className="space-y-4">
        <div 
          className="p-4 rounded-lg text-white"
          style={{ backgroundColor: colors.primary }}
        >
          Primary Color Button
        </div>
        <div 
          className="p-4 rounded-lg text-white"
          style={{ backgroundColor: colors.secondary }}
        >
          Secondary Color Button
        </div>
        <div 
          className="p-4 rounded-lg border-2"
          style={{ 
            borderColor: colors.primary,
            color: colors.primary,
          }}
        >
          Outline Button
        </div>
        <div className="flex gap-2">
          <span 
            className="px-2 py-1 rounded-full text-xs font-medium"
            style={{ 
              backgroundColor: `${colors.primary}20`,
              color: colors.primary,
            }}
          >
            Primary Badge
          </span>
          <span 
            className="px-2 py-1 rounded-full text-xs font-medium"
            style={{ 
              backgroundColor: `${colors.secondary}20`,
              color: colors.secondary,
            }}
          >
            Secondary Badge
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="h-2 rounded-full"
            style={{ 
              width: '60%',
              background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ThemePreview;