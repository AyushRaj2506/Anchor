import { useEffect, useRef } from 'react';

export function useDialog(open, onClose, busy = false) {
  const ref = useRef(null);
  const lastFocus = useRef(null);
  const options = useRef({ onClose, busy, open });
  options.current = { onClose, busy, open };
  useEffect(() => {
    const remember = event => { if (!options.current.open) lastFocus.current = event.target; };
    document.addEventListener('focusin', remember);
    return () => document.removeEventListener('focusin', remember);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = lastFocus.current || document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => [...(ref.current?.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]') || [])]
      .filter(element => !element.disabled && element.getAttribute('aria-hidden') !== 'true'
        && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden');
    focusable()[0]?.focus();
    function handleKey(event) {
      if (event.key === 'Escape' && !options.current.busy) options.current.onClose();
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!elements.length) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handleKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  return ref;
}
