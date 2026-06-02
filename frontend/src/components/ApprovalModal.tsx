import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export interface ApprovalModalProps {
  open: boolean;
  sessionId: string | null;
  busy: boolean;
  onClose: () => void;
  onDecision: (
    action: "approve" | "reject" | "review",
    notes: string,
  ) => Promise<void>;
}

export function ApprovalModal({
  open,
  sessionId,
  busy,
  onClose,
  onDecision,
}: ApprovalModalProps) {
  const [notes, setNotes] = useState("");

  return (
    <AnimatePresence>
      {open && sessionId ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            className="glass-card glow-purple max-w-md border border-cf-purple/30 p-6"
          >
            <h3 className="text-lg font-semibold tracking-wide text-cf-text">
              Human gate
            </h3>
            <p className="mt-1 font-hud text-xs text-cf-muted">
              Session {sessionId.slice(0, 8)}…
            </p>
            <p className="mt-3 text-sm text-cf-muted">
              The council recommends action. Approve to proceed, reject to halt
              automation, or flag for review.
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-4 w-full rounded-xl border border-white/10 bg-[#0A1628]/90 px-3 py-2 text-sm text-cf-text outline-none focus:border-cf-purple/40"
              placeholder="Optional notes…"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecision("approve", notes)}
                className="rounded-lg bg-cf-teal/90 px-4 py-2 text-sm font-semibold text-[#050B18] transition hover:bg-cf-teal disabled:opacity-40"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecision("reject", notes)}
                className="rounded-lg border border-cf-coral/50 bg-cf-coral/15 px-4 py-2 text-sm font-semibold text-cf-coral transition hover:bg-cf-coral/25 disabled:opacity-40"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecision("review", notes)}
                className="rounded-lg border border-cf-amber/40 px-4 py-2 text-sm font-semibold text-cf-amber transition hover:bg-cf-amber/10 disabled:opacity-40"
              >
                Review
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="ml-auto rounded-lg border border-white/15 px-4 py-2 text-sm text-cf-muted hover:text-cf-text"
              >
                Later
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
