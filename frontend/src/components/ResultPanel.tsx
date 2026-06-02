import { AnimatePresence, motion } from "framer-motion";
import { useId } from "react";
import type { PipelineStatus, WorkflowResult } from "@/types/workflow";

export interface ResultPanelProps {
  result: WorkflowResult | null;
  visible: boolean;
  pipelineStatus: PipelineStatus;
  /** Shown when pipeline is awaiting approval — triggers quick actions (notes optional in modal). */
  onApprove?: () => void;
  onReject?: () => void;
  onReview?: () => void;
}

type CouncilShape = {
  recommendation?: string;
  reasoning?: string[];
  tradeoffs?: string[];
  priority_actions?: Array<{
    action?: string;
    deadline?: string;
    responsible_party?: string;
  }>;
  confidence_score?: number;
};

function asCouncil(raw: Record<string, unknown> | null): CouncilShape {
  if (!raw) return {};
  return {
    recommendation: typeof raw.recommendation === "string" ? raw.recommendation : undefined,
    reasoning: Array.isArray(raw.reasoning)
      ? raw.reasoning.filter((x): x is string => typeof x === "string")
      : undefined,
    tradeoffs: Array.isArray(raw.tradeoffs)
      ? raw.tradeoffs.filter((x): x is string => typeof x === "string")
      : undefined,
    priority_actions: Array.isArray(raw.priority_actions)
      ? (raw.priority_actions as CouncilShape["priority_actions"])
      : undefined,
    confidence_score: typeof raw.confidence_score === "number" ? raw.confidence_score : undefined,
  };
}

function ConfidenceRing({ value }: { value: number }) {
  const gradId = useId().replace(/:/g, "");
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = c * (pct / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex h-[92px] w-[92px] items-center justify-center">
        <svg width="92" height="92" viewBox="0 0 92 92" className="absolute inset-0 -rotate-90">
          <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx="46"
            cy="46"
            r={r}
            fill="none"
            stroke={`url(#cfConfGrad-${gradId})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
          />
          <defs>
            <linearGradient id={`cfConfGrad-${gradId}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6C63FF" />
              <stop offset="100%" stopColor="#00D4AA" />
            </linearGradient>
          </defs>
        </svg>
        <span className="relative text-lg font-semibold tabular-nums text-cf-text">{pct}%</span>
      </div>
      <span className="font-hud text-[11px] text-cf-muted">Confidence</span>
    </div>
  );
}

export function ResultPanel({
  result,
  visible,
  pipelineStatus,
  onApprove,
  onReject,
  onReview,
}: ResultPanelProps) {
  const councilRaw = result?.council_recommendation;
  const council = asCouncil(
    councilRaw && typeof councilRaw === "object"
      ? (councilRaw as Record<string, unknown>)
      : null,
  );

  const showApproval =
    pipelineStatus === "awaiting_approval" && onApprove && onReject && onReview;

  return (
    <AnimatePresence>
      {visible && result && councilRaw ? (
        <motion.div
          key="panel"
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 28 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="glass-card flex min-h-0 max-h-[min(70vh,calc(100vh-14rem))] flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-y-contain p-5"
        >
          <div className="agent-line w-full shrink-0" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-bold uppercase tracking-widest text-cf-muted">
                Council recommendation
              </h2>
              <p className="mt-3 text-xl font-medium leading-relaxed text-cf-teal">
                {council.recommendation ??
                  "The council produced structured output without a plain-language summary."}
              </p>
            </div>
            {council.confidence_score != null ? (
              <div className="shrink-0 scale-90">
                <ConfidenceRing value={council.confidence_score} />
              </div>
            ) : null}
          </div>

          {council.reasoning?.length ? (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-cf-muted">
                Reasoning
              </h3>
              <ul className="mt-2 space-y-2">
                {council.reasoning.map((line, i) => (
                  <motion.li
                    key={`${i}-${line.slice(0, 24)}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * i, type: "spring", stiffness: 380, damping: 28 }}
                    className="flex gap-2 text-sm leading-relaxed text-cf-text/95"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cf-purple shadow-[0_0_10px_rgba(108,99,255,0.7)]" />
                    <span>{line}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          ) : null}

          {council.tradeoffs?.length ? (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-cf-amber/90">
                Tradeoffs
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-cf-amber/95">
                {council.tradeoffs.map((t, i) => (
                  <li key={i} className="border-l-2 border-cf-amber/40 pl-3">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {council.priority_actions?.length ? (
            <div className="min-w-0">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-cf-muted">
                Priority actions
              </h3>
              <div className="mt-2 overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full min-w-[320px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/30 font-hud text-[10px] uppercase tracking-wider text-cf-muted">
                      <th className="px-3 py-2">Action</th>
                      <th className="px-3 py-2">Deadline</th>
                      <th className="px-3 py-2">Responsible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {council.priority_actions.map((row, i) => (
                      <tr key={i} className="border-b border-white/5 last:border-0">
                        <td className="px-3 py-2 text-cf-text">{row?.action ?? "—"}</td>
                        <td className="px-3 py-2 text-cf-muted">{row?.deadline ?? "—"}</td>
                        <td className="px-3 py-2 text-cf-muted">{row?.responsible_party ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {showApproval ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2 border-t border-white/10 pt-4"
            >
              <button
                type="button"
                onClick={onApprove}
                className="rounded-lg bg-cf-teal/90 px-4 py-2 text-sm font-semibold text-[#050B18] shadow-sm transition hover:bg-cf-teal"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={onReject}
                className="rounded-lg bg-cf-coral/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cf-coral"
              >
                Reject
              </button>
            </motion.div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
