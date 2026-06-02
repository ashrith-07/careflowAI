import {
  Suspense,
  lazy,
  useCallback,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

import { AgentCard } from "@/components/AgentCard";
import { ApprovalModal } from "@/components/ApprovalModal";
import { AuditLog, type AuditLine } from "@/components/AuditLog";
import { EmailInput } from "@/components/EmailInput";
import { ResultPanel } from "@/components/ResultPanel";
import { useElapsed } from "@/hooks/useElapsed";
import { useWorkflow } from "@/hooks/useWorkflow";
import { api } from "@/lib/api";
import type { ProcessEmailResponse } from "@/types/api";

const AgentOrbit = lazy(() =>
  import("@/components/AgentOrbit").then((m) => ({ default: m.AgentOrbit })),
);

const MAX_STREAM_CHARS = 1800;

function truncateId(id: string | null, n = 10) {
  if (!id) return "—";
  return id.length <= n ? id : `${id.slice(0, n)}…`;
}

export default function App() {
  const { status, setStatus } = useWorkflow();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<string>("idle");
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [completedAgents, setCompletedAgents] = useState<string[]>([]);
  const [result, setResult] = useState<ProcessEmailResponse | null>(null);
  const [auditLines, setAuditLines] = useState<AuditLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const runIdRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);

  const elapsedMs = useElapsed(status === "running");

  const pushLog = useCallback((message: string, kind: AuditLine["kind"] = "info") => {
    setAuditLines((prev) => [...prev, { t: Date.now(), message, kind }]);
  }, []);

  const finishRun = useCallback(
    (payload: ProcessEmailResponse | null, err?: string) => {
      if (err) {
        setError(err);
        setStatus("error");
        pushLog(err, "err");
        return;
      }
      if (!payload) return;
      setResult(payload);
      setSessionId(payload.session_id);
      setWorkflowStatus(String(payload.status));
      setActiveAgent(null);
      setCompletedAgents([
        "email_agent",
        "memory_agent",
        "logistics_agent",
        "council_agent",
      ]);
      if (payload.status === "failed") {
        setStatus("error");
        pushLog((payload.errors && payload.errors[0]) || "Workflow failed", "err");
        return;
      }
      if (payload.status === "awaiting_approval") {
        setStatus("awaiting_approval");
        setModalOpen(true);
        pushLog("Workflow awaiting human approval", "ok");
      } else {
        setStatus("done");
        pushLog("Workflow complete", "ok");
      }
    },
    [pushLog, setStatus],
  );

  const closeEs = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  };

  const handleRun = useCallback(
    (email: string) => {
      const runId = ++runIdRef.current;
      setError(null);
      setResult(null);
      setCompletedAgents([]);
      setActiveAgent(null);
      setSessionId(null);
      setWorkflowStatus("running");
      setAuditLines([]);
      setStatus("running");
      closeEs();
      pushLog("Initializing neural routing…", "info");

      const abortIfStale = () => runIdRef.current !== runId;

      if (email.length > MAX_STREAM_CHARS) {
        void (async () => {
          try {
            pushLog("Payload length > stream cap — using batch POST", "info");
            const { data } = await api.post<ProcessEmailResponse>("/process-email", {
              email,
            });
            if (abortIfStale()) return;
            finishRun(data);
          } catch (e: unknown) {
            const msg =
              e && typeof e === "object" && "response" in e
                ? JSON.stringify(
                    (e as { response?: { data?: unknown } }).response?.data,
                  )
                : String(e);
            if (!abortIfStale()) finishRun(null, msg);
          }
        })();
        return;
      }

      const url = `/api/process-email/stream?email=${encodeURIComponent(email)}`;
      const es = new EventSource(url);
      esRef.current = es;

      const onStarted = (ev: MessageEvent) => {
        if (abortIfStale()) return;
        try {
          const d = JSON.parse(ev.data) as { agent: string; session_id?: string };
          if (d.session_id) setSessionId(d.session_id);
          setActiveAgent(d.agent);
          pushLog(`▶ ${d.agent}`, "info");
        } catch {
          pushLog("Malformed agent_started payload", "err");
        }
      };

      const onCompleted = (ev: MessageEvent) => {
        if (abortIfStale()) return;
        try {
          const d = JSON.parse(ev.data) as { agent: string };
          setCompletedAgents((prev) =>
            prev.includes(d.agent) ? prev : [...prev, d.agent],
          );
          pushLog(`✓ ${d.agent}`, "ok");
        } catch {
          pushLog("Malformed agent_completed payload", "err");
        }
      };

      const onDone = (ev: MessageEvent) => {
        if (abortIfStale()) return;
        try {
          const d = JSON.parse(ev.data) as { result?: ProcessEmailResponse };
          es.close();
          esRef.current = null;
          if (d.result) finishRun(d.result);
          else finishRun(null, "Missing result in workflow_completed");
        } catch (e) {
          es.close();
          finishRun(null, String(e));
        }
      };

      const onFailed = (ev: MessageEvent) => {
        if (abortIfStale()) return;
        try {
          const d = JSON.parse(ev.data) as {
            errors?: string[];
            error?: string;
            result?: ProcessEmailResponse;
          };
          es.close();
          esRef.current = null;
          if (d.result) {
            finishRun(d.result);
            return;
          }
          const msg =
            (d.errors && d.errors[0]) || d.error || "workflow_failed";
          finishRun(null, msg);
        } catch (e) {
          es.close();
          finishRun(null, String(e));
        }
      };

      const onErr = (ev: MessageEvent) => {
        if (abortIfStale()) return;
        try {
          const d = JSON.parse(ev.data) as { message?: string; error?: string };
          es.close();
          esRef.current = null;
          finishRun(null, d.message || d.error || "Stream error");
        } catch {
          es.close();
          finishRun(null, "Stream error");
        }
      };

      es.addEventListener("agent_started", onStarted);
      es.addEventListener("agent_completed", onCompleted);
      es.addEventListener("workflow_completed", onDone);
      es.addEventListener("workflow_failed", onFailed);
      es.addEventListener("error", ((e: Event) => {
        if (!("data" in e)) return;
        const me = e as MessageEvent;
        if (typeof me.data !== "string" || !me.data) return;
        onErr(me);
      }) as EventListener);

      es.onerror = () => {
        if (abortIfStale()) return;
        if (es.readyState === EventSource.CLOSED) return;
        es.close();
        esRef.current = null;
        finishRun(null, "EventSource connection error");
      };
    },
    [finishRun, pushLog, setStatus],
  );

  const handleApprove = async (action: "approve" | "reject" | "review", notes: string) => {
    if (!sessionId) return;
    setApprovalBusy(true);
    try {
      await api.post(`/sessions/${sessionId}/approve`, { action, notes });
      pushLog(`Human ${action} recorded`, "ok");
      setModalOpen(false);
      if (action === "approve") setWorkflowStatus("approved");
      else if (action === "reject") setWorkflowStatus("rejected");
      else setWorkflowStatus("awaiting_approval");
    } catch (e) {
      pushLog(`Approval API error: ${String(e)}`, "err");
    } finally {
      setApprovalBusy(false);
    }
  };

const showResults =
    result !== null &&
    (status === "done" ||
      status === "awaiting_approval" ||
      status === "error");

  return (
    <div className="relative min-h-screen text-cf-text">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_rgba(108,99,255,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(0,212,170,0.08),_transparent_50%)]" />
      <div className="hud-scan z-[1]" />

      <header className="relative z-20 border-b border-white/10 bg-[#050B18]/85 px-4 py-3 backdrop-blur-md lg:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4 font-hud text-[11px] text-cf-muted">
            <span>
              <span className="text-cf-purple/90">SESSION</span>{" "}
              <span className="text-cf-text">{truncateId(sessionId, 12)}</span>
            </span>
            <span className="hidden h-4 w-px bg-white/15 sm:inline" />
            <span>
              <span className="text-cf-teal/90">STATE</span>{" "}
              <span className="uppercase text-cf-text">
                {status === "running" ? workflowStatus : status}
              </span>
            </span>
            <span className="hidden h-4 w-px bg-white/15 sm:inline" />
            <span>
              <span className="text-cf-amber/90">ELAPSED</span>{" "}
              <span className="text-cf-text tabular-nums">
                {(elapsedMs / 1000).toFixed(1)}s
              </span>
            </span>
          </div>
          <AnimatePresence>
            {error ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg border border-cf-coral/40 bg-cf-coral/10 px-3 py-2 text-xs text-cf-coral"
              >
                {error}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-8 px-4 py-8 lg:flex-row lg:gap-6 lg:px-8">
        <aside className="flex w-full flex-col gap-6 lg:w-[30%] lg:min-w-0">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-2xl font-semibold tracking-wide text-cf-text drop-shadow-[0_0_28px_rgba(108,99,255,0.45)]">
              CareFlow AI
            </h1>
            <p className="mt-1 max-w-sm text-sm leading-relaxed tracking-wide text-cf-muted">
              Multi-Agent Caregiving Intelligence
            </p>
            <div className="agent-line mt-4 max-w-xs" />
          </motion.div>
          <EmailInput disabled={status === "running"} onSubmit={handleRun} />
        </aside>

        <section className="flex w-full flex-col gap-5 lg:w-[40%] lg:min-w-0">
          <Suspense
            fallback={
              <div className="glass-card flex h-[400px] w-full animate-pulse items-center justify-center text-sm text-cf-muted">
                Initializing orbital field…
              </div>
            }
          >
            <AgentOrbit
              activeAgent={activeAgent}
              completedAgents={completedAgents}
            />
          </Suspense>
          <AgentCard
            activeAgent={activeAgent}
            completedAgents={completedAgents}
          />
        </section>

        <aside className="flex w-full flex-col gap-5 lg:w-[30%] lg:min-w-0">
          <ResultPanel result={result} visible={Boolean(showResults)} />
          <AuditLog lines={auditLines} />
        </aside>
      </main>

      <ApprovalModal
        open={modalOpen}
        sessionId={sessionId}
        busy={approvalBusy}
        onClose={() => setModalOpen(false)}
        onDecision={handleApprove}
      />
    </div>
  );
}
