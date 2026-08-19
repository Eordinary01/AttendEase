import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-7xl',
};

const Modal = ({ isOpen, onClose, title, subtitle, children, size = 'md', footer, error }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex items-center justify-center min-h-screen px-4 py-8 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <motion.div
              className={`inline-block align-bottom bg-surface rounded-2xl text-left overflow-hidden shadow-pop sm:my-8 sm:align-middle ${sizeMap[size]} w-full border border-line relative z-10`}
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring', duration: 0.35 }}
            >
              <div className="px-6 py-5 border-b border-line flex justify-between items-start bg-background/60">
                <div>
                  <h3 className="text-lg font-bold text-ink tracking-tight">{title}</h3>
                  {subtitle && <p className="text-sm text-ink-faint mt-0.5">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-ink-faint hover:text-ink hover:bg-line/60 rounded-full transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>



              <div className="px-6 py-5">{children}</div>
              {footer && <div className="px-6 py-4 border-t border-line bg-background/60 flex justify-end gap-3">{footer}</div>}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
