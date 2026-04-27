import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function ToastContainer() {
  const { toasts } = useApp();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto flex items-center gap-2.5 px-5 py-3 bg-[#111827] dark:bg-[#1e2740] text-white rounded-2xl shadow-2xl border border-white/10"
          >
            <CheckCircle className="w-4.5 h-4.5 text-[#00FFF4] shrink-0" />
            <span className="text-[14px]" style={{ fontWeight: 500 }}>{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
