import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { onRequestActivity } from '../../api/client';

/** Thin bar at the top of the window while any API request is in flight. */
export function TopProgress() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = onRequestActivity((pending) => {
      window.clearTimeout(timer);
      // Skip flicker for instant responses; linger briefly so the finish is visible.
      timer = window.setTimeout(() => setBusy(pending > 0), pending > 0 ? 120 : 200);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);
  return (
    <AnimatePresence>
      {busy && (
        <motion.div
          className="top-progress"
          role="progressbar"
          aria-label="Đang tải dữ liệu"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 0.85, transition: { duration: 6, ease: [0.1, 0.9, 0.2, 1] } }}
          exit={{ scaleX: 1, opacity: 0, transition: { duration: 0.3 } }}
        />
      )}
    </AnimatePresence>
  );
}
