import React from 'react';

/**
 * SkipLink
 * WCAG 2.1 accessible skip link. Jumps keyboard focus directly to main content.
 */
export const SkipLink = ({ targetId = 'main-content' }) => {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:font-semibold focus:rounded-lg focus:shadow-pop focus:outline-none focus:ring-2 focus:ring-primary/50 transition-transform"
    >
      Skip to main content
    </a>
  );
};

export default SkipLink;
