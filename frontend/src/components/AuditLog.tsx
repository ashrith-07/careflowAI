import { motion } from "framer-motion";

export interface AuditLine {
  t: number;
  message: string;
  kind?: "info" | "ok" | "err";
}

export interface AuditLogProps {
  lines: AuditLine[];
}

export function AuditLog({ lines }: AuditLogProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-card flex max-h-56 flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-cf-muted">
          Telemetry
        </span>
        <span className="font-hud text-[10px] text-cf-purple">{lines.length} evt</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-hud text-[11px] leading-relaxed">
        {lines.length === 0 ? (
          <p className="text-cf-muted/80">Awaiting run…</p>
        ) : (
          lines.map((l) => (
            <div
              key={l.t + l.message}
              className={
                l.kind === "err"
                  ? "text-cf-coral"
                  : l.kind === "ok"
                    ? "text-cf-teal"
                    : "text-cf-muted"
              }
            >
              <span className="text-cf-purple/80">
                [{new Date(l.t).toLocaleTimeString()}]
              </span>{" "}
              {l.message}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
