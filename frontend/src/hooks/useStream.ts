import { useCallback, useRef, useState } from "react";

export function useStream() {
  const [chunks, setChunks] = useState<string[]>([]);
  const buffer = useRef<string[]>([]);

  const push = useCallback((text: string) => {
    buffer.current.push(text);
    setChunks([...buffer.current]);
  }, []);

  const clear = useCallback(() => {
    buffer.current = [];
    setChunks([]);
  }, []);

  return { chunks, push, clear };
}
