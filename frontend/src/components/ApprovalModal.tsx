import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ApprovalModalProps {
  open: boolean;
  sessionId: string | null;
  busy: boolean;
  summary: string;
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
  summary,
  onClose,
  onDecision,
}: ApprovalModalProps) {
  const [notes, setNotes] = useState("");
  const [rejectConfirm, setRejectConfirm] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      setNotes("");
      setRejectConfirm(false);
    }
  }, [open]);

  const safeClose = useCallback(() => {
    if (busy) return;
    setRejectConfirm(false);
    onClose();
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        safeClose();
      }
      if (e.key === "Enter" && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === "textarea") return;
        if (rejectConfirm) return;
        e.preventDefault();
        if (!busy && sessionId) {
          void onDecision("approve", notes);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, sessionId, notes, onDecision, rejectConfirm, safeClose]);

  const runReject = () => {
    if (rejectConfirm) {
      void onDecision("reject", notes);
      setRejectConfirm(false);
    } else {
      setRejectConfirm(true);
    }
  };

  return (
    <AnimatePresence>
      {open && sessionId ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="approval-title"
          className="fixed inset-0 z-[100] flex flex-col bg-[#030712]/92 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 280, damping: 32 }}
              className="glass-card glow-purple relative w-full max-w-lg border border-cf-purple/25 p-6 sm:p-8"
            >
              <h3 id="approval-title" className="text-lg font-semibold tracking-wide text-cf-text">
                Human approval
              </h3>
              <p className="mt-2 font-hud text-[11px] text-cf-muted">
                Session ID{" "}
                <span className="select-all break-all text-cf-purple/90">{sessionId}</span>
              </p>
              <p className="mt-4 text-sm leading-relaxed text-cf-muted">{summary}</p>

              <label className="mt-5 block text-[10px] font-bold uppercase tracking-widest text-cf-muted">
                Notes <span className="font-normal normal-case text-cf-muted/70">(optional)</span>
              </label>
              <textarea
                ref={notesRef}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                disabled={busy}
                className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#050B14]/90 px-3 py-2 text-sm text-cf-text outline-none ring-cf-purple/20 focus:border-cf-purple/40 focus:ring-2 disabled:opacity-50"
                placeholder="Context for compliance or the care team…"
              />

              {rejectConfirm ? (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 rounded-lg border border-cf-coral/35 bg-cf-coral/10 px-3 py-2 text-xs text-cf-coral"
                >
                  Rejecting stops automation for this session. Click{" "}
                  <span className="font-semibold">Reject</span> again to confirm, or Cancel.
                </motion.p>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecision("approve", notes)}
                  className="rounded-xl bg-emerald-500/90 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-500 disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={runReject}
                  className={rejectConfirm
                    ? "rounded-xl bg-cf-coral px-4 py-2.5 text-sm font-semibold text-white ring-2 ring-cf-coral/60 disabled:opacity-40"
                    : "rounded-xl bg-rose-600/85 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-40"}
                >
                  {rejectConfirm ? "Confirm reject" : "Reject"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecision("review", notes)}
                  className="rounded-xl border border-amber-400/50 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-40"
                >
                  Review
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (rejectConfirm ? setRejectConfirm(false) : safeClose())}
                  className="ml-auto rounded-xl border border-white/15 px-4 py-2.5 text-sm text-cf-muted transition hover:border-white/25 hover:text-cf-text disabled:opacity-40"
                >
                  {rejectConfirm ? "Cancel" : "Close"}
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
