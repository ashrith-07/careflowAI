import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { AgentCard } from "@/components/AgentCard";
import { ApprovalModal } from "@/components/ApprovalModal";
import { AuditLog } from "@/components/AuditLog";
import { EmailInput } from "@/components/EmailInput";
import { ResultPanel } from "@/components/ResultPanel";
import { useWorkflow } from "@/hooks/useWorkflow";

const AGENTS = [
  {
    id: "email_agent",
    name: "Email Agent",
    description: "Extracts structured information from inbound caregiver and clinic messages.",
    icon: "mail",
  },
  {
    id: "memory_agent",
    name: "Memory Agent",
    description: "Pulls patient context, history, and constraints from institutional memory.",
    icon: "database",
  },
  {
    id: "logistics_agent",
    name: "Logistics Agent",
    description: "Reasons about appointments, transport windows, and scheduling conflicts.",
    icon: "truck",
  },
  {
    id: "council_agent",
    name: "Council Agent",
    description: "Synthesizes analyses into a compassionate, actionable recommendation.",
    icon: "gavel",
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

export default function App() {
  const wf = useWorkflow();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (wf.status === "awaiting_approval") setModalOpen(true);
  }, [wf.status]);

  const resultVisible = useMemo(() => {
    return Boolean(wf.result?.council_recommendation) && wf.status !== "idle";
  }, [wf.result?.council_recommendation, wf.status]);

  const openApproval = () => setModalOpen(true);

  return (
    <div className="relative min-h-screen text-cf-text">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_rgba(108,99,255,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(0,212,170,0.08),_transparent_50%)]" />
      <div className="hud-scan z-[1]" />

      <header className="relative z-20 border-b border-white/10 bg-[#050B18]/85 px-4 py-3 backdrop-blur-md lg:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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

      <main className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-8 px-4 py-8 lg:flex-row lg:gap-6 lg:px-8">
        <aside className="flex w-full flex-col gap-6 lg:w-[28%] lg:min-w-0">
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
          <EmailInput
            disabled={wf.status === "running"}
            isRunning={wf.status === "running"}
            onSubmit={(email) => void wf.submitEmail(email)}
          />
        </aside>

        <section className="flex w-full flex-col gap-4 lg:w-[42%] lg:min-w-0">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-cf-muted">
            Agent pipeline
          </h2>
          <div className="flex flex-col gap-3">
            {AGENTS.map((a) => {
              const snap = wf.agentSnapshots[a.id];
              return (
                <AgentCard
                  key={a.id}
                  id={a.id}
                  name={a.name}
                  description={a.description}
                  icon={a.icon}
                  status={cardStatus(a.id, wf)}
                  output={snap?.output}
                  duration={snap?.durationMs}
                />
              );
            })}
          </div>
        </section>

        <aside className="flex w-full flex-col gap-5 lg:w-[30%] lg:min-w-0">
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
