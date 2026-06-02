import { motion, AnimatePresence } from "framer-motion";
import type { ProcessEmailResponse } from "@/types/api";

export interface ResultPanelProps {
  result: ProcessEmailResponse | null;
  visible: boolean;
}

function Block({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown> | null;
}) {
  if (!data) {
    return (
      <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-cf-muted">
        {title}: <span className="italic">No structured output</span>
      </div>
    );
  }
  return (
    <details
      open
      className="group rounded-lg border border-white/10 bg-black/25 px-3 py-2"
    >
      <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-wider text-cf-purple">
        {title}
      </summary>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-hud text-[11px] leading-relaxed text-cf-muted">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

export function ResultPanel({ result, visible }: ResultPanelProps) {
  return (
    <AnimatePresence>
      {visible && result ? (
        <motion.div
          key="panel"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="glass-card flex max-h-[calc(100vh-12rem)] flex-col gap-3 overflow-hidden p-4"
        >
          <div className="agent-line w-full shrink-0" />
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-cf-text">
              Council output
            </h2>
            <p className="text-xs text-cf-muted">
              Structured intelligence from all agents
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
            <Block title="Email analysis" data={result.email_analysis} />
            <Block title="Memory context" data={result.memory_context} />
            <Block title="Logistics" data={result.logistics_analysis} />
            <Block title="Council recommendation" data={result.council_recommendation} />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
