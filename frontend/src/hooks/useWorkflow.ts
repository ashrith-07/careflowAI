import { useCallback, useState } from "react";

export function useWorkflow() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );

  const reset = useCallback(() => setStatus("idle"), []);

  return { status, setStatus, reset };
}
