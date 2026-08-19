import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

const ToastContext = createContext({
  toast: () => { },
  success: () => { },
  error: () => { },
  warning: () => { },
  info: () => { },
});

export const useToast = () => useContext(ToastContext);

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES = {
  success: "bg-emerald-50/95 border-emerald-200 text-emerald-950 shadow-emerald-500/10",
  error: "bg-rose-50/95 border-rose-200 text-rose-950 shadow-rose-500/10",
  warning: "bg-amber-50/95 border-amber-200 text-amber-950 shadow-amber-500/10",
  info: "bg-sky-50/95 border-sky-200 text-sky-950 shadow-sky-500/10",
};

const ICON_STYLES = {
  success: "text-emerald-600 bg-emerald-100/80 p-1.5 rounded-xl",
  error: "text-rose-600 bg-rose-100/80 p-1.5 rounded-xl",
  warning: "text-amber-600 bg-amber-100/80 p-1.5 rounded-xl",
  info: "text-sky-600 bg-sky-100/80 p-1.5 rounded-xl",
};

let toastId = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const removeToast = useCallback((id) => {
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const lastToastRef = useRef({ message: "", time: 0 });

  const addToast = useCallback(
    (message, type = "info", duration = 4000) => {
      if (!message) return;
      const now = Date.now();
      if (lastToastRef.current.message === message && now - lastToastRef.current.time < 1500) {
        return;
      }
      lastToastRef.current = { message, time: now };

      const id = ++toastId;
      setToasts((prev) => [...prev.slice(-4), { id, message, type }]);

      if (duration > 0) {
        timers.current[id] = setTimeout(() => removeToast(id), duration);
      }

      return id;
    },
    [removeToast]
  );

  useEffect(() => {
    window.notifyToast = (message, type = "info", duration = 4000) => {
      if (!message) return;
      addToast(message, type, duration);
    };
    return () => {
      delete window.notifyToast;
    };
  }, [addToast]);

  const toast = useCallback(
    (message, opts = {}) => addToast(message, opts.type || "info", opts.duration),
    [addToast]
  );

  const success = useCallback((msg, opts) => toast(msg, { ...opts, type: "success" }), [toast]);
  const error = useCallback((msg, opts) => toast(msg, { ...opts, type: "error", duration: 6000 }), [toast]);
  const warning = useCallback((msg, opts) => toast(msg, { ...opts, type: "warning" }), [toast]);
  const info = useCallback((msg, opts) => toast(msg, { ...opts, type: "info" }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      <div className="fixed top-5 left-5 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(({ id, message, type }) => {
            const Icon = ICONS[type];
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, x: -100, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -100, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className={`pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-xl backdrop-blur-md max-w-md ${STYLES[type]}`}
              >
                <Icon className={`w-8 h-8 flex-shrink-0 ${ICON_STYLES[type]}`} />
                <div className="flex-1 pt-0.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider opacity-75 mb-0.5">
                    {type === "success" ? "Success" : type === "error" ? "Notification" : type === "warning" ? "Warning" : "Information"}
                  </p>
                  <p className="text-sm font-semibold leading-snug">{message}</p>
                </div>
                <button
                  onClick={() => removeToast(id)}
                  className="flex-shrink-0 p-1 rounded-lg hover:bg-black/10 transition-colors"
                >
                  <X className="w-4 h-4 opacity-70 hover:opacity-100" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
