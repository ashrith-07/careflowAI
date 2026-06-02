import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import { AgentCard } from "@/components/AgentCard";
import { ApprovalModal } from "@/components/ApprovalModal";
import { AuditLog } from "@/components/AuditLog";
import { EmailInput } from "@/components/EmailInput";
import { ResultPanel } from "@/components/ResultPanel";
import { useWorkflow } from "@/hooks/useWorkflow";

const AgentOrbit = lazy(() =>
  import("@/components/AgentOrbit").then((m) => ({ default: m.AgentOrbit })),
);

const AGENTS = [
  {
    id: "email_agent",
    name: "Email Agent",
    description: "Extracts structured information from inbound caregiver and clinic messages.",
  },
  {
    id: "memory_agent",
    name: "Memory Agent",
    description: "Pulls patient context, history, and constraints from institutional memory.",
  },
  {
    id: "logistics_agent",
    name: "Logistics Agent",
    description: "Reasons about appointments, transport windows, and scheduling conflicts.",
  },
  {
    id: "council_agent",
    name: "Council Agent",
    description: "Synthesizes analyses into a compassionate, actionable recommendation.",
  },
] as const;

function truncateId(id: string | null, n = 12) {
  if (!id) return "—";
  return id.length <= n ? id : `${id.slice(0, n)}…`;
}

function cardStatus(
  id: string,
  wf: ReturnType<typeof useWorkflow>,
): "idle" | "running" | "completed" | "failed" {
  const { status, activeAgent, completedAgents, failedAgent } = wf;
  if (status === "failed" && failedAgent === id) return "failed";
  if (activeAgent === id && status === "running") return "running";
  if (completedAgents.includes(id)) return "completed";
  return "idle";
}

function councilSummary(wf: ReturnType<typeof useWorkflow>): string {
  const raw = wf.result?.council_recommendation;
  if (raw && typeof raw === "object" && "recommendation" in raw) {
    const r = (raw as { recommendation?: string }).recommendation;
    if (typeof r === "string" && r.trim()) return r.trim();
  }
  return "The council has issued a recommendation. Please review notes and telemetry, then choose an outcome.";
}

function OrbitPanel(props: { activeAgent: string | null; completedAgents: string[] }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full animate-pulse items-center justify-center rounded-xl border border-white/10 bg-black/20 text-xs text-cf-muted">
          Loading orbital field…
        </div>
      }
    >
      <AgentOrbit activeAgent={props.activeAgent} completedAgents={props.completedAgents} />
    </Suspense>
  );
}

function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="glass-card glow-purple relative max-h-[85vh] w-full max-w-lg overflow-y-auto border border-cf-purple/25 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 rounded-lg px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-cf-muted transition hover:bg-white/10 hover:text-cf-text"
              aria-label="Close help"
            >
              Close
            </button>
            <h2 id="help-title" className="pr-10 text-lg font-semibold text-cf-text">
              Quick walkthrough
            </h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-cf-muted">
              <li>
                Paste or compose an email in <strong className="text-cf-text">Inbound signal</strong>. Use{" "}
                <strong className="text-cf-text">Use demo email</strong> for a ready-made Dr.&nbsp;Patel thread.
              </li>
              <li>
                Press <strong className="text-cf-text">Process Email</strong> to stream the four agents: Email →
                Memory → Logistics → Council.
              </li>
              <li>
                Watch the <strong className="text-cf-text">HUD</strong> for session id, live agent, and elapsed time.
                The <strong className="text-cf-text">orbital view</strong> highlights the active node.
              </li>
              <li>
                When the council finishes, the <strong className="text-cf-text">recommendation panel</strong> fills
                with reasoning, tradeoffs, priority actions, and confidence.
              </li>
              <li>
                If status is <strong className="text-cf-text">awaiting approval</strong>, use the modal or panel
                actions — reject opens the modal for a confirmed decision with optional notes.
              </li>
              <li>
                Expand <strong className="text-cf-text">Audit log</strong> to inspect per-agent payloads and export
                JSON.
              </li>
            </ol>
            <p className="mt-5 text-xs text-cf-muted/80">
              Set <code className="text-cf-teal/90">VITE_API_URL</code> in <code>frontend/.env</code> (see{" "}
              <code className="text-cf-purple/90">frontend/.env.example</code>) to your FastAPI base URL without the{" "}
              <code>/api</code> suffix. Ensure <code className="text-cf-purple/90">GROQ_API_KEY</code> is set in{" "}
              <code>backend/.env</code>.
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function App() {
  const wf = useWorkflow();
  const [modalOpen, setModalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (wf.status === "awaiting_approval") setModalOpen(true);
  }, [wf.status]);

  const resultVisible = useMemo(() => {
    return Boolean(wf.result?.council_recommendation) && wf.status !== "idle";
  }, [wf.result?.council_recommendation, wf.status]);

  const openApproval = () => setModalOpen(true);

  return (
    <div className="cf-app-shell relative min-h-screen text-cf-text">
      <div className="hud-scan z-[1]" />

      <header className="relative z-20 border-b border-white/10 bg-[#050B18]/88 px-4 py-3 backdrop-blur-md md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-hud text-[11px] text-cf-muted">
            <span>
              <span className="text-cf-purple/90">SESSION</span>{" "}
              <span className="select-all text-cf-text">{truncateId(wf.sessionId, 14)}</span>
            </span>
            <span className="hidden h-4 w-px bg-white/15 sm:inline" />
            <span>
              <span className="text-cf-teal/90">STATUS</span>{" "}
              <span className="uppercase text-cf-text">{wf.status}</span>
            </span>
            <span className="hidden h-4 w-px bg-white/15 sm:inline" />
            <span>
              <span className="text-cf-amber/90">AGENT</span>{" "}
              <span className="max-w-[140px] truncate text-cf-text sm:max-w-[200px]">
                {wf.activeAgent ?? "—"}
              </span>
            </span>
            <span className="hidden h-4 w-px bg-white/15 sm:inline" />
            <span>
              <span className="text-cf-amber/90">ELAPSED</span>{" "}
              <span className="tabular-nums text-cf-text">
                {(wf.elapsedMs / 1000).toFixed(1)}s
              </span>
            </span>
            {wf.status === "awaiting_approval" ? (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="rounded border border-cf-purple/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cf-purple/90 transition hover:bg-cf-purple/15"
              >
                Approval
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => wf.reset()}
              className="rounded border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cf-muted transition hover:border-cf-purple/40 hover:text-cf-text"
            >
              Reset
            </button>
          </div>
          <AnimatePresence>
            {wf.error ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-xl rounded-lg border border-cf-coral/40 bg-cf-coral/10 px-3 py-2 text-xs text-cf-coral"
              >
                {wf.error}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-4 py-6 md:flex-row md:items-start md:gap-6 md:px-8 md:py-8">
        {/* Mobile: 3D orbit on top */}
        <div className="h-[250px] w-full shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30 md:hidden">
          <OrbitPanel activeAgent={wf.activeAgent} completedAgents={wf.completedAgents} />
        </div>

        <aside className="flex w-full min-w-0 flex-shrink-0 flex-col gap-6 md:w-[28%]">
          <motion.div initial={false}>
            <h1 className="text-2xl font-semibold tracking-wide text-cf-text drop-shadow-[0_0_28px_rgba(108,99,255,0.45)]">
              CareFlow AI
            </h1>
            <p className="mt-1 max-w-sm text-sm leading-relaxed tracking-wide text-cf-muted">
              Multi-Agent Caregiving Intelligence
            </p>
            <div className="agent-line mt-4 max-w-xs" />
          </motion.div>
          <EmailInput
            disabled={wf.status === "running"}
            isRunning={wf.status === "running"}
            onSubmit={(email) => void wf.submitEmail(email)}
          />
        </aside>

        <section className="flex w-full min-w-0 flex-shrink-0 flex-col gap-4 md:w-[42%]">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-cf-muted">
            Agent pipeline
          </h2>
          <div className="hidden h-[min(420px,40vh)] w-full overflow-hidden rounded-xl border border-white/10 bg-black/25 md:block">
            <OrbitPanel activeAgent={wf.activeAgent} completedAgents={wf.completedAgents} />
          </div>
          <div className="flex flex-col gap-3">
            {AGENTS.map((a) => {
              const snap = wf.agentSnapshots[a.id];
              return (
                <AgentCard
                  key={a.id}
                  id={a.id}
                  name={a.name}
                  description={a.description}
                  status={cardStatus(a.id, wf)}
                  output={snap?.output}
                  duration={snap?.durationMs}
                />
              );
            })}
          </div>
        </section>

        <aside className="flex w-full min-h-0 min-w-0 flex-shrink-0 flex-col gap-5 md:w-[30%]">
          <ResultPanel
            result={wf.result}
            visible={resultVisible}
            pipelineStatus={wf.status}
            onApprove={
              wf.status === "awaiting_approval"
                ? () => void wf.approveWorkflow("approve", "")
                : undefined
            }
            onReject={
              wf.status === "awaiting_approval"
                ? () => {
                    openApproval();
                  }
                : undefined
            }
            onReview={
              wf.status === "awaiting_approval"
                ? () => void wf.approveWorkflow("review", "")
                : undefined
            }
          />
          <AuditLog rows={wf.auditRows} />
        </aside>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-[#050B18]/80 py-4 text-center text-[11px] text-cf-muted backdrop-blur-sm">
        CareFlow AI · 2026
      </footer>

      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-6 right-6 z-[200] flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-[#0A1628]/95 text-cf-text shadow-glow-purple backdrop-blur-md transition hover:border-cf-purple/50 hover:bg-cf-purple/20"
        aria-label="Open help walkthrough"
      >
        <span className="text-sm font-semibold tracking-wide text-cf-purple" aria-hidden>
          ?
        </span>
      </button>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <ApprovalModal
        open={modalOpen}
        sessionId={wf.sessionId}
        busy={wf.approvalBusy}
        summary={councilSummary(wf)}
        onClose={() => setModalOpen(false)}
        onDecision={async (action, notes) => {
          await wf.approveWorkflow(action, notes);
          setModalOpen(false);
        }}
      />
    </div>
  );
}
