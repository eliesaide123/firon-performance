import { useEffect, useRef } from 'react';

const SELECTOR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Dialog keyboard contract: Esc closes, Tab cycles inside, focus moves in on
 * open and returns to the opener on close, and the page behind cannot scroll.
 * Not a component — an internal helper shared by the overlay components.
 */
export default function useFpFocusTrap(open: boolean, onClose?: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const node = ref.current;
    const previous = document.activeElement;
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>(SELECTOR) ?? [])
      .filter((el) => el.offsetParent !== null);

    (focusables()[0] ?? node)?.focus?.();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) { e.preventDefault(); return; }
      const idx = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && idx <= 0) { e.preventDefault(); items[items.length - 1]!.focus(); }
      else if (!e.shiftKey && idx === items.length - 1) { e.preventDefault(); items[0]!.focus(); }
    };

    node?.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      node?.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (previous instanceof HTMLElement) previous.focus?.();
    };
  }, [open, onClose]);

  return ref;
}
