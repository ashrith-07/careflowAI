import { AnimatePresence, motion } from "framer-motion";
import { Fragment, useEffect, useRef, useState } from "react";

import type { AuditRow } from "@/hooks/useWorkflow";
import { colorizeJsonValue } from "@/lib/jsonColorize";

export interface AuditLogProps {
  rows: AuditRow[];
  defaultExpanded?: boolean;
}

function statusLabel(s: AuditRow["status"]) {
  if (s === "ok") return "ok";
  if (s === "err") return "err";
  return "running";
}

function formatTs(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "—";
  }
}

export function AuditLog({ rows, defaultExpanded = false }: AuditLogProps) {
  const [open, setOpen] = useState(defaultExpanded);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || rows.length === 0) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [rows.length, open]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `careflow-audit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      layout
      className="glass-card flex flex-col overflow-hidden border border-white/10"
    >
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left transition hover:opacity-90"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-cf-muted">
            Audit log
          </span>
          <p className="mt-0.5 text-xs text-cf-muted/90">
            Agent runs, timings, and payloads ({rows.length} entries)
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={exportJson}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-black/30 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-cf-muted transition hover:border-cf-purple/40 hover:text-cf-text disabled:opacity-30"
          >
            Export JSON
          </button>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-white/10 p-2 text-cf-muted transition hover:bg-white/[0.05] hover:text-cf-text"
          >
            <span className="font-mono text-sm leading-none text-cf-muted" aria-hidden>
              {open ? "▲" : "▼"}
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="max-h-72 overflow-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                <thead className="sticky top-0 z-[1] bg-[#050B14]/95 font-hud text-[10px] uppercase tracking-wider text-cf-muted backdrop-blur-sm">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2">Agent</th>
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-cf-muted">
                        No audit entries yet. Run a workflow to populate this log.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const isRowOpen = expandedKey === row.key;
                      return (
                        <Fragment key={row.key}>
                          <tr
                            className="cursor-pointer border-b border-white/5 transition hover:bg-white/[0.04]"
                            onClick={() =>
                              setExpandedKey((k) => (k === row.key ? null : row.key))
                            }
                          >
                            <td className="px-3 py-2 font-medium text-cf-text">{row.agent}</td>
                            <td className="px-3 py-2 font-mono text-[10px] text-cf-muted">
                              {formatTs(row.timestamp)}
                            </td>
                            <td className="px-3 py-2 font-mono tabular-nums text-cf-muted">
                              {row.durationMs} ms
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={
                                  row.status === "ok"
                                    ? "text-cf-teal"
                                    : row.status === "err"
                                      ? "text-cf-coral"
                                      : "text-cf-amber"
                                }
                              >
                                {statusLabel(row.status)}
                              </span>
                            </td>
                          </tr>
                          {isRowOpen ? (
                            <tr className="border-b border-white/10 bg-black/35">
                              <td colSpan={4} className="px-3 py-3 align-top">
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-cf-muted">
                                  Input / output
                                </p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <p className="mb-1 text-[10px] text-cf-purple/90">Input</p>
                                    <pre className="max-h-48 overflow-auto rounded-lg border border-white/10 bg-[#050B14]/90 p-2 font-mono text-[10px] leading-relaxed">
                                      {colorizeJsonValue(row.input ?? null)}
                                    </pre>
                                  </div>
                                  <div>
                                    <p className="mb-1 text-[10px] text-cf-purple/90">Output</p>
                                    <pre className="max-h-48 overflow-auto rounded-lg border border-white/10 bg-[#050B14]/90 p-2 font-mono text-[10px] leading-relaxed">
                                      {colorizeJsonValue(row.output ?? null)}
                                    </pre>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
              <div ref={bottomRef} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
