import { useEffect, useRef, useCallback, useState } from 'react';

export function useAutoRefresh(intervalMs: number, callback: () => void) {
  const savedCallback = useRef(callback);
  const [active, setActive] = useState(intervalMs > 0);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active || intervalMs <= 0) return;
    const id = setInterval(() => savedCallback.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);

  const toggle = useCallback(() => setActive((a) => !a), []);

  return { active, toggle };
}
