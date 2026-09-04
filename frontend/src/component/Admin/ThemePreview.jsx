import React from 'react';
import { useTheme } from '../../contexts/ThemeContexts';
import Card from '../common/ui/Card';
import Badge from '../common/ui/Badge';
import Button from '../common/ui/Button';

const ThemePreview = () => {
  const { colors } = useTheme();

  return (
    <Card padding="md" bordered>
      <h4 className="font-bold text-xs text-ink uppercase tracking-wider mb-3">Live Design System Preview</h4>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div 
            className="p-3 rounded-xl text-white text-xs font-bold text-center shadow-xs"
            style={{ backgroundColor: colors.primary }}
          >
            Primary Accent
          </div>
          <div 
            className="p-3 rounded-xl text-white text-xs font-bold text-center shadow-xs"
            style={{ backgroundColor: colors.secondary }}
          >
            Secondary Accent
          </div>
        </div>

        <div 
          className="p-2.5 rounded-xl border text-xs font-bold text-center"
          style={{ 
            borderColor: `${colors.primary}40`,
            backgroundColor: `${colors.primary}08`,
            color: colors.primary,
          }}
        >
          Interactive Component Surface
        </div>

        <div className="flex gap-2">
          <span 
            className="px-2.5 py-1 rounded-lg text-xs font-bold"
            style={{ 
              backgroundColor: `${colors.primary}18`,
              color: colors.primary,
              border: `1px solid ${colors.primary}30`
            }}
          >
            Primary Tag
          </span>
          <span 
            className="px-2.5 py-1 rounded-lg text-xs font-bold"
            style={{ 
              backgroundColor: `${colors.secondary}18`,
              color: colors.secondary,
              border: `1px solid ${colors.secondary}30`
            }}
          >
            Secondary Tag
          </span>
        </div>

        <div className="w-full bg-line/50 rounded-full h-2 overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-300"
            style={{ 
              width: '65%',
              background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`
            }}
          />
        </div>
      </div>
    </Card>
  );
};

export default ThemePreview;