import { useCallback, useEffect, useRef } from 'react';

export function useStudyTimer() {
  const elapsed = useRef(0);
  const since = useRef<number | null>(null);
  useEffect(() => {
    const pause = () => { if (since.current !== null) { elapsed.current += Date.now() - since.current; since.current = null; } };
    const resume = () => { if (document.visibilityState === 'visible' && document.hasFocus() && since.current === null) since.current = Date.now(); };
    const visibility = () => { if (document.visibilityState === 'hidden') pause(); else resume(); };
    resume();
    window.addEventListener('blur', pause); window.addEventListener('focus', resume); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('blur', pause); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  return useCallback(() => {
    const now = Date.now();
    const seconds = Math.round((elapsed.current + (since.current === null ? 0 : now - since.current)) / 1000);
    elapsed.current = 0;
    if (since.current !== null) since.current = now;
    return seconds;
  }, []);
}