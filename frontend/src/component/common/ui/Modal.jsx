import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
};

const Modal = ({ isOpen, onClose, title, subtitle, children, size = 'md', footer }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Solid scrim without ambient blur per specification */}
          <motion.div
            className="fixed inset-0 bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />

          <div className="flex items-center justify-center min-h-screen px-4 py-8 text-center sm:p-0">
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <motion.div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? 'modal-title' : undefined}
              className={`
                inline-block align-bottom bg-surface rounded-lg text-left overflow-hidden
                shadow-level4 border border-line-strong sm:my-8 sm:align-middle ${sizeMap[size] || sizeMap.md} w-full relative z-10
              `}
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {/* Institutional Roofline Strip */}
              <div className="h-[2.5px] w-full bg-gradient-to-r from-primary via-primary-light to-secondary shrink-0" />

              <div className="px-5 py-4 border-b border-line flex justify-between items-start bg-surface">
                <div>
                  <h3 id="modal-title" className="text-base font-semibold text-ink tracking-tight">
                    {title}
                  </h3>
                  {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface-subtle rounded transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 bg-surface text-ink text-sm">{children}</div>

              {footer && (
                <div className="px-5 py-3.5 border-t border-line bg-surface-subtle flex justify-end gap-2.5">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;

