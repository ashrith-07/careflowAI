import { clsx } from "clsx";
import { motion } from "framer-motion";

const AGENTS = [
  { id: "email_agent", label: "Email", short: "Parse & extract" },
  { id: "memory_agent", label: "Memory", short: "SQLite context" },
  { id: "logistics_agent", label: "Logistics", short: "Schedule & transport" },
  { id: "council_agent", label: "Council", short: "Deliberation" },
] as const;

export interface AgentCardProps {
  activeAgent: string | null;
  completedAgents: string[];
}

export function AgentCard({ activeAgent, completedAgents }: AgentCardProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {AGENTS.map((a, i) => {
        const done = completedAgents.includes(a.id);
        const active = activeAgent === a.id;
        return (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
            className={clsx(
              "glass-card relative overflow-hidden p-3 transition-shadow",
              active && "glow-teal ring-1 ring-cf-teal/40",
              done && !active && "ring-1 ring-cf-teal/20",
            )}
          >
            {active ? (
              <motion.span
                className="absolute inset-0 bg-gradient-to-br from-cf-purple/15 to-transparent"
                animate={{ opacity: [0.4, 0.85, 0.4] }}
                transition={{ duration: 2.2, repeat: Infinity }}
              />
            ) : null}
            <div className="relative">
              <p className="text-[10px] font-bold uppercase tracking-widest text-cf-muted">
                {a.label}
              </p>
              <p className="mt-1 text-xs text-cf-text">{a.short}</p>
              <p className="mt-2 font-hud text-[10px] text-cf-teal">
                {done ? "COMPLETE" : active ? "LIVE" : "STANDBY"}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
