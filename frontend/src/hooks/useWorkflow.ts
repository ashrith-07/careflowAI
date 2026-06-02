import { useCallback, useEffect, useRef, useState } from "react";

import {
  approveSession,
  axiosErrorMessage,
  processEmail,
  streamEmail,
} from "@/lib/api";
import type { StreamEvent, WorkflowResult } from "@/types/workflow";

const MAX_STREAM = 1800;

const AGENT_OUTPUT_KEY: Record<string, keyof WorkflowResult> = {
  email_agent: "email_analysis",
  memory_agent: "memory_context",
  logistics_agent: "logistics_analysis",
  council_agent: "council_recommendation",
};

export interface AgentSnapshot {
  output?: object;
  durationMs?: number;
}

export interface AuditRow {
  key: string;
  agent: string;
  timestamp: number;
  durationMs: number;
  status: "ok" | "err" | "running";
  input?: unknown;
  output?: unknown;
}

/** Client-side workflow UI state (not LangGraph TypedDict). */
export interface WorkflowState {
  status:
    | "idle"
    | "running"
    | "awaiting_approval"
    | "approved"
    | "rejected"
    | "failed";
  sessionId: string | null;
  activeAgent: string | null;
  completedAgents: string[];
  result: WorkflowResult | null;
  error: string | null;
  elapsedMs: number;
  streamEvents: StreamEvent[];
  agentSnapshots: Record<string, AgentSnapshot>;
  failedAgent: string | null;
  auditRows: AuditRow[];
}

const initialState = (): WorkflowState => ({
  status: "idle",
  sessionId: null,
  activeAgent: null,
  completedAgents: [],
  result: null,
  error: null,
  elapsedMs: 0,
  streamEvents: [],
  agentSnapshots: {},
  failedAgent: null,
  auditRows: [],
});

function extractDurationMs(updates: Record<string, unknown>): number | undefined {
  const trail = updates.audit_trail;
  if (!Array.isArray(trail) || trail.length === 0) return undefined;
  const last = trail[trail.length - 1] as { duration_ms?: number };
  return typeof last.duration_ms === "number" ? last.duration_ms : undefined;
}

function buildAuditRowsFromTrail(trail: unknown[]): AuditRow[] {
  return trail.map((raw, idx) => {
    const e = raw as Record<string, unknown>;
    const ok = e.ok !== false;
    let ts = Date.now();
    if (typeof e.timestamp === "string") {
      const p = Date.parse(e.timestamp);
      if (!Number.isNaN(p)) ts = p;
    } else if (typeof e.ts === "number") ts = e.ts;
    return {
      key: `trail-${idx}-${String(e.agent ?? idx)}`,
      agent: String(e.agent ?? "—"),
      timestamp: ts,
      durationMs: Number(e.duration_ms ?? 0),
      status: ok ? "ok" : "err",
      input: e.input_data,
      output: e.output_data,
    };
  });
}

function applyWorkflowResult(
  prev: WorkflowState,
  result: WorkflowResult,
): Partial<WorkflowState> {
  const snaps: Record<string, AgentSnapshot> = { ...prev.agentSnapshots };
  for (const agent of Object.keys(AGENT_OUTPUT_KEY)) {
    const key = AGENT_OUTPUT_KEY[agent];
    const chunk = result[key];
    if (chunk && typeof chunk === "object") {
      snaps[agent] = { output: chunk as object };
    }
  }
  const audit = Array.isArray(result.audit_trail)
    ? buildAuditRowsFromTrail(result.audit_trail)
    : prev.auditRows;

  let status: WorkflowState["status"] = "approved";
  if (result.status === "awaiting_approval") status = "awaiting_approval";
  else if (result.status === "failed") status = "failed";
  else if (result.status === "rejected") status = "rejected";
  else if (result.status === "approved") status = "approved";
  else if (result.status === "completed") status = "approved";

  return {
    result,
    sessionId: result.session_id,
    activeAgent: null,
    completedAgents: [
      "email_agent",
      "memory_agent",
      "logistics_agent",
      "council_agent",
    ],
    agentSnapshots: snaps,
    auditRows: audit,
    status,
    error:
      result.status === "failed"
        ? (result.errors && result.errors[0]) || "Workflow failed"
        : null,
  };
}

export function useWorkflow() {
  const [state, setState] = useState<WorkflowState>(initialState);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const runIdRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (state.status !== "running") return;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      setState((s) => ({
        ...s,
        elapsedMs: Math.round(performance.now() - t0),
      }));
    }, 100);
    return () => window.clearInterval(id);
  }, [state.status]);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    runIdRef.current += 1;
    setState(initialState());
  }, []);

  const applyStreamEvent = useCallback(
    (ev: StreamEvent, runId: number) => {
      if (runIdRef.current !== runId) return;
      setState((prev) => {
        const streamEvents = [...prev.streamEvents, ev];
        switch (ev.type) {
          case "agent_started": {
            return {
              ...prev,
              streamEvents,
              sessionId: ev.session_id ?? prev.sessionId,
              activeAgent: ev.agent,
            };
          }
          case "agent_completed": {
            const { agent, updates } = ev;
            const snaps = { ...prev.agentSnapshots };
            const field = AGENT_OUTPUT_KEY[agent];
            if (field && updates[field] && typeof updates[field] === "object") {
              snaps[agent] = {
                output: updates[field] as object,
                durationMs: extractDurationMs(updates),
              };
            } else if (extractDurationMs(updates) != null) {
              snaps[agent] = {
                ...snaps[agent],
                durationMs: extractDurationMs(updates),
              };
            }
            const completedAgents = prev.completedAgents.includes(agent)
              ? prev.completedAgents
              : [...prev.completedAgents, agent];
            let auditRows = prev.auditRows;
            const trail = updates.audit_trail;
            if (Array.isArray(trail) && trail.length) {
              auditRows = buildAuditRowsFromTrail(trail);
            }
            return {
              ...prev,
              streamEvents,
              agentSnapshots: snaps,
              completedAgents,
              auditRows,
            };
          }
          case "workflow_completed": {
            const merged = applyWorkflowResult(prev, ev.result);
            return {
              ...prev,
              ...merged,
              streamEvents,
            };
          }
          case "workflow_failed": {
            const next: WorkflowState = {
              ...prev,
              streamEvents,
              status: "failed",
              error:
                (ev.errors && ev.errors[0]) ||
                ev.error ||
                "Workflow failed",
              activeAgent: null,
              failedAgent: ev.failed_at_agent ?? null,
            };
            if (ev.result) {
              Object.assign(next, applyWorkflowResult(prev, ev.result));
              next.status = "failed";
              next.error =
                (ev.errors && ev.errors[0]) ||
                ev.error ||
                next.error ||
                "Workflow failed";
            }
            return next;
          }
          case "error": {
            return {
              ...prev,
              streamEvents,
              status: "failed",
              error: ev.detail,
              activeAgent: null,
            };
          }
          default:
            return { ...prev, streamEvents };
        }
      });
    },
    [],
  );

  const submitEmail = useCallback(
    async (email: string) => {
      const runId = ++runIdRef.current;
      cleanupRef.current?.();
      cleanupRef.current = null;

      setState({
        ...initialState(),
        status: "running",
      });

      const finishIfStale = () => runIdRef.current !== runId;

      if (email.length > MAX_STREAM) {
        try {
          const result = await processEmail(email);
          if (finishIfStale()) return;
          setState((prev) => ({
            ...prev,
            ...applyWorkflowResult(prev, result),
            streamEvents: [
              ...prev.streamEvents,
              { type: "workflow_completed", result, at: Date.now() },
            ],
          }));
        } catch (err) {
          if (finishIfStale()) return;
          setState((prev) => ({
            ...prev,
            status: "failed",
            error: axiosErrorMessage(err),
            streamEvents: [
              ...prev.streamEvents,
              {
                type: "error",
                detail: axiosErrorMessage(err),
                at: Date.now(),
              },
            ],
          }));
        }
        return;
      }

      const cleanup = streamEmail(email, (ev) => {
        applyStreamEvent(ev, runId);
      });
      cleanupRef.current = cleanup;
    },
    [applyStreamEvent],
  );

  const approveWorkflow = useCallback(
    async (action: "approve" | "reject" | "review", notes: string) => {
      const id = stateRef.current.sessionId;
      if (!id) return;
      setApprovalBusy(true);
      try {
        await approveSession(id, action, notes);
        setState((prev) => ({
          ...prev,
          status:
            action === "approve"
              ? "approved"
              : action === "reject"
                ? "rejected"
                : "awaiting_approval",
          error: null,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: axiosErrorMessage(err),
        }));
      } finally {
        setApprovalBusy(false);
      }
    },
    [],
  );

  return {
    ...state,
    approvalBusy,
    submitEmail,
    approveWorkflow,
    reset,
  };
}
