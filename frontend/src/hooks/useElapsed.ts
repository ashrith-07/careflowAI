import { useEffect, useRef, useState } from "react";

export function useElapsed(running: boolean) {
  const [ms, setMs] = useState(0);
  const start = useRef<number | null>(null);
  const id = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      start.current = performance.now();
      setMs(0);
      id.current = setInterval(() => {
        if (start.current != null) {
          setMs(Math.round(performance.now() - start.current));
        }
      }, 100);
      return () => {
        if (id.current) clearInterval(id.current);
      };
    }
    if (id.current) clearInterval(id.current);
    start.current = null;
    return undefined;
  }, [running]);

  return ms;
}
