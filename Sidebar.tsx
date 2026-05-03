import { motion } from 'motion/react';
import { MessageSquare } from 'lucide-react';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-slate-950">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-emerald-500 dark:text-emerald-400 mb-4"
      >
        <MessageSquare size={84} fill="currentColor" fillOpacity={0.1} />
      </motion.div>
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-2xl font-bold tracking-tight"
      >
        Nexus Chat
      </motion.h1>
      <div className="mt-12 w-48 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
        <motion.div 
          className="absolute inset-y-0 left-0 bg-emerald-500 dark:bg-emerald-400"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}
