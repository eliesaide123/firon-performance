import { useEffect, useState } from 'react';

/** Debounce a fast-changing value (search inputs) before it reaches a query key. */
export default function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
