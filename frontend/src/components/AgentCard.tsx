import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";

const ACCENTS: Record<string, string> = {
  email_agent: "border-l-cf-coral",
  memory_agent: "border-l-cf-amber",
  logistics_agent: "border-l-cf-teal",
  council_agent: "border-l-cf-purple",
};

export interface AgentCardProps {
  id: string;
  name: string;
  description: string;
  status: "idle" | "running" | "completed" | "failed";
  output?: object;
  duration?: number;
}

export function AgentCard({
  id,
  name,
  description,
  status,
  output,
  duration,
}: AgentCardProps) {
  const accent = ACCENTS[id] ?? "border-l-white/30";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={clsx(
        "glass-card relative overflow-hidden border-l-4 pl-4",
        accent,
        status === "running" && "ring-1 ring-cf-purple/35",
      )}
    >
      {status === "running" ? (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
          initial={{ x: "-60%" }}
          animate={{ x: "120%" }}
          transition={{ duration: 1.35, repeat: Infinity, ease: "linear" }}
        />
      ) : null}

      <div className="relative flex gap-3 py-3 pr-3">
        <div className="flex w-10 shrink-0 flex-col items-center pt-0.5">
          <StatusGlyph status={status} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold tracking-wide text-cf-text">{name}</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-cf-muted">{description}</p>
            </div>
            {status === "completed" && duration != null ? (
              <span className="ml-auto shrink-0 rounded-md border border-white/10 bg-black/25 px-2 py-0.5 font-hud text-[10px] tabular-nums text-cf-teal/90">
                {duration}ms
              </span>
            ) : null}
          </div>

          <AnimatePresence initial={false}>
            {status === "running" ? (
              <motion.div
                key="sk"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-3 space-y-2"
              >
                <div className="h-2 w-[80%] max-w-[280px] rounded bg-white/[0.06]" />
                <div className="h-2 w-[60%] max-w-[200px] rounded bg-white/[0.05]" />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {status === "completed" && output ? (
              <motion.div
                key="out"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 32 }}
                className="overflow-hidden"
              >
                <motion.pre
                  initial={{ y: -6 }}
                  animate={{ y: 0 }}
                  className="mt-3 max-h-52 overflow-auto rounded-lg border border-white/10 bg-[#050B14]/80 p-3 font-mono text-[11px] leading-relaxed text-cf-text"
                >
                  <JsonColored obj={output} />
                </motion.pre>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.article>
  );
}

function StatusGlyph({ status }: { status: AgentCardProps["status"] }) {
  if (status === "idle") {
    return <span className="mt-1 h-2 w-2 rounded-full bg-white/25" title="Idle" />;
  }
  if (status === "running") {
    return (
      <span className="relative mt-0.5 flex h-4 w-4 items-center justify-center" title="Running">
        <span className="absolute h-3.5 w-3.5 rounded-full border-2 border-cf-purple/35" />
        <motion.span
          className="absolute h-3.5 w-3.5 rounded-full border-2 border-cf-purple border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
        />
      </span>
    );
  }
  if (status === "completed") {
    return <span className="mt-1 block h-2 w-2 rounded-full bg-cf-teal/85" title="Completed" />;
  }
  return <span className="mt-1 block h-2 w-2 rounded-full bg-cf-coral/90" title="Failed" />;
}

function JsonColored({ obj }: { obj: object }) {
  let s: string;
  try {
    s = JSON.stringify(obj, null, 2);
  } catch {
    return <>{"[unserializable]"}</>;
  }
  return <>{colorizePlain(s)}</>;
}

function colorizePlain(s: string) {
  const parts = s.split(
    /("(?:\\.|[^"])*"\s*:)|("(?:\\.|[^"])*")|(\b\d+\.?\d*\b)|(\btrue|false|null\b)|([{}[\],:])|(\s+)/g,
  );
  return parts
    .filter((p) => p !== undefined && p !== "")
    .map((part, i) => {
      if (/^\s+$/.test(part)) return <span key={i}>{part}</span>;
      if (/^"(?:\\.|[^"])*"\s*:$/.test(part)) {
        return (
          <span key={i} className="text-cf-purple">
            {part}
          </span>
        );
      }
      if (part.startsWith('"')) {
        return (
          <span key={i} className="text-cf-teal">
            {part}
          </span>
        );
      }
      if (/^\d/.test(part)) {
        return (
          <span key={i} className="text-cf-amber">
            {part}
          </span>
        );
      }
      if (part === "true" || part === "false" || part === "null") {
        return (
          <span key={i} className="text-cf-purple/80">
            {part}
          </span>
        );
      }
      if (/[{}[\],:]/.test(part)) {
        return (
          <span key={i} className="text-cf-muted/90">
            {part}
          </span>
        );
      }
      return (
        <span key={i} className="text-cf-text">
          {part}
        </span>
      );
    });
}
