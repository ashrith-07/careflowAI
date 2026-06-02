import axios, { type AxiosError } from "axios";

import type {
  AuditEntry,
  SessionDetail,
  StreamEvent,
  WorkflowResult,
} from "@/types/workflow";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

const MAX_STREAM_URL = 1800;

export async function processEmail(email: string): Promise<WorkflowResult> {
  const { data } = await api.post<WorkflowResult>("/process-email", { email });
  return data;
}

/**
 * Opens SSE to /api/process-email/stream. Invokes onEvent for each parsed frame.
 * Returns cleanup that closes the EventSource.
 */
export function streamEmail(
  email: string,
  onEvent: (e: StreamEvent) => void,
): () => void {
  if (email.length > MAX_STREAM_URL) {
    onEvent({
      type: "error",
      detail: `Email exceeds ${MAX_STREAM_URL} characters for streaming; use processEmail() instead.`,
      at: Date.now(),
    });
    return () => {};
  }

  const url = `/api/process-email/stream?email=${encodeURIComponent(email)}`;
  const es = new EventSource(url);

  const emit = (ev: StreamEvent) => onEvent({ ...ev, at: ev.at ?? Date.now() });

  const onStarted = (e: MessageEvent) => {
    try {
      const d = JSON.parse(e.data) as { agent: string; session_id?: string };
      emit({
        type: "agent_started",
        agent: d.agent,
        session_id: d.session_id,
        raw: d,
        at: Date.now(),
      });
    } catch {
      emit({ type: "error", detail: "Invalid agent_started payload", at: Date.now() });
    }
  };

  const onCompleted = (e: MessageEvent) => {
    try {
      const d = JSON.parse(e.data) as { agent: string; updates?: Record<string, unknown> };
      emit({
        type: "agent_completed",
        agent: d.agent,
        updates: (d.updates ?? {}) as Record<string, unknown>,
        raw: d,
        at: Date.now(),
      });
    } catch {
      emit({ type: "error", detail: "Invalid agent_completed payload", at: Date.now() });
    }
  };

  const onDone = (e: MessageEvent) => {
    try {
      const d = JSON.parse(e.data) as { result?: WorkflowResult };
      es.close();
      if (d.result) {
        emit({ type: "workflow_completed", result: d.result, at: Date.now() });
      } else {
        emit({ type: "error", detail: "workflow_completed missing result", at: Date.now() });
      }
    } catch (err) {
      es.close();
      emit({
        type: "error",
        detail: err instanceof Error ? err.message : "workflow_completed parse error",
        at: Date.now(),
      });
    }
  };

  const onFailed = (e: MessageEvent) => {
    try {
      const d = JSON.parse(e.data) as {
        errors?: string[];
        error?: string;
        result?: WorkflowResult | null;
        failed_at_agent?: string;
      };
      es.close();
      emit({
        type: "workflow_failed",
        errors: d.errors,
        error: d.error,
        result: d.result ?? undefined,
        failed_at_agent: d.failed_at_agent,
        at: Date.now(),
      });
    } catch (err) {
      es.close();
      emit({
        type: "error",
        detail: err instanceof Error ? err.message : "workflow_failed parse error",
        at: Date.now(),
      });
    }
  };

  const onSseError = (e: Event) => {
    if (!("data" in e)) return;
    const me = e as MessageEvent;
    if (typeof me.data !== "string" || !me.data) return;
    try {
      const d = JSON.parse(me.data) as { message?: string; error?: string };
      es.close();
      emit({
        type: "error",
        detail: d.message || d.error || "Server error event",
        at: Date.now(),
      });
    } catch {
      es.close();
      emit({ type: "error", detail: "Server error event (unparsed)", at: Date.now() });
    }
  };

  es.addEventListener("agent_started", onStarted);
  es.addEventListener("agent_completed", onCompleted);
  es.addEventListener("workflow_completed", onDone);
  es.addEventListener("workflow_failed", onFailed);
  es.addEventListener("error", onSseError as EventListener);

  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) return;
    es.close();
    emit({ type: "error", detail: "EventSource connection error", at: Date.now() });
  };

  return () => {
    es.close();
  };
}

export async function approveSession(
  id: string,
  action: string,
  notes: string,
): Promise<void> {
  await api.post(`/sessions/${id}/approve`, { action, notes });
}

/** Resolves GET /sessions/:id into a WorkflowResult-shaped payload for the UI. */
export async function getSession(id: string): Promise<WorkflowResult> {
  const { data } = await api.get<SessionDetail>(`/sessions/${id}`);
  const rd = data.result_data;
  if (rd && typeof rd === "object") {
    const w = rd as Partial<WorkflowResult> & Record<string, unknown>;
    return {
      session_id: String(w.session_id ?? data.id),
      status: String(w.status ?? data.status),
      email_analysis:
        w.email_analysis && typeof w.email_analysis === "object"
          ? (w.email_analysis as Record<string, unknown>)
          : null,
      memory_context:
        w.memory_context && typeof w.memory_context === "object"
          ? (w.memory_context as Record<string, unknown>)
          : null,
      logistics_analysis:
        w.logistics_analysis && typeof w.logistics_analysis === "object"
          ? (w.logistics_analysis as Record<string, unknown>)
          : null,
      council_recommendation:
        w.council_recommendation && typeof w.council_recommendation === "object"
          ? (w.council_recommendation as Record<string, unknown>)
          : null,
      audit_trail: Array.isArray(w.audit_trail) ? w.audit_trail : [],
      errors: Array.isArray(w.errors) ? (w.errors as string[]) : undefined,
      current_agent: typeof w.current_agent === "string" ? w.current_agent : undefined,
    };
  }
  return {
    session_id: data.id,
    status: data.status,
    email_analysis: null,
    memory_context: null,
    logistics_analysis: null,
    council_recommendation: null,
    audit_trail: Array.isArray(data.audit_log) ? data.audit_log : [],
  };
}

export async function getAuditLog(id: string): Promise<AuditEntry[]> {
  const { data } = await api.get<{ audit_log: AuditEntry[] }>(`/sessions/${id}/audit`);
  return data.audit_log ?? [];
}

export function axiosErrorMessage(err: unknown): string {
  const ax = err as AxiosError<{ detail?: unknown }>;
  if (ax.response?.data?.detail !== undefined) {
    const d = ax.response.data.detail;
    return typeof d === "string" ? d : JSON.stringify(d);
  }
  return ax.message || String(err);
}
