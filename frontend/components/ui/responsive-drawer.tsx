'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SWIPE_CLOSE_THRESHOLD = 60;

type ResponsiveDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** lg+ : панель справа; иначе снизу */
  sideFromLg?: boolean;
};

function useIsLgUp() {
  const [lg, setLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const fn = () => setLg(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return lg;
}

export function ResponsiveDrawer({
  open,
  onClose,
  title,
  children,
  className,
  sideFromLg = true,
}: ResponsiveDrawerProps) {
  const isLg = useIsLgUp();
  const showSide = sideFromLg && isLg;
  const dragStartY = useRef<number | null>(null);

  const getClientY = (e: MouseEvent | TouchEvent) =>
    'touches' in e ? e.touches[0].clientY : e.clientY;

  useEffect(() => {
    if (!open || showSide) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (dragStartY.current === null) return;
      const y = getClientY(e);
      if (y - dragStartY.current > SWIPE_CLOSE_THRESHOLD) {
        onClose();
        dragStartY.current = null;
      }
    };
    const handleUp = () => {
      dragStartY.current = null;
    };
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchend', handleUp);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchend', handleUp);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [open, onClose, showSide]);

  const onHandlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      dragStartY.current =
        'touches' in e
          ? (e as React.TouchEvent).touches[0].clientY
          : (e as React.MouseEvent).clientY;
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const style = document.body.style;
    const prevOverflow = style.overflow;
    const prevTouchAction = style.touchAction;
    style.overflow = 'hidden';
    style.touchAction = 'none';
    return () => {
      style.overflow = prevOverflow;
      style.touchAction = prevTouchAction;
    };
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={cn('fixed inset-0 z-[10000]', className)}
          style={{ pointerEvents: 'auto', isolation: 'isolate' }}
          aria-modal="true"
          role="dialog">
          <motion.button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {showSide ? (
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl laptop:max-w-lg desktop:max-w-xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                {title ? (
                  <h2 className="text-lg font-semibold">{title}</h2>
                ) : (
                  <span />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  className="!h-9 !min-h-9 !w-9 !min-w-9 shrink-0 !p-0 md:!h-10 md:!w-10"
                  onClick={onClose}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">{children}</div>
            </motion.aside>
          ) : (
            <div className="absolute inset-0 flex items-end justify-center">
              <motion.div
                initial={{ y: '80%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="w-full max-h-[95dvh] overflow-y-auto rounded-t-2xl border border-b-0 border-border bg-card shadow-lg"
                onClick={(e) => e.stopPropagation()}>
                <div
                  role="button"
                  tabIndex={0}
                  onPointerDown={onHandlePointerDown}
                  className="flex min-h-[44px] cursor-grab touch-none items-center justify-center py-3 select-none active:cursor-grabbing"
                  style={{ touchAction: 'none' }}
                  aria-label="Потяните вниз, чтобы закрыть">
                  <span className="block h-1 w-16 rounded-full bg-muted" />
                </div>
                {title && (
                  <h2 className="px-4 pb-3 text-center text-lg font-semibold">{title}</h2>
                )}
                <div className="px-4 pb-6">{children}</div>
              </motion.div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
