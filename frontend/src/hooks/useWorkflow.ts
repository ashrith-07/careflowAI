import { useCallback, useState } from "react";

export type UiWorkflowStatus =
  | "idle"
  | "running"
  | "awaiting_approval"
  | "done"
  | "error";

export function useWorkflow() {
  const [status, setStatus] = useState<UiWorkflowStatus>("idle");

  const reset = useCallback(() => setStatus("idle"), []);

  return { status, setStatus, reset };
}
