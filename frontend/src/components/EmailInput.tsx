import { motion } from "framer-motion";
import { useState } from "react";

const MAX_STREAM = 1800;

export const DEMO_EMAIL = `Subject: Reschedule — Dr. Patel neurology

Hi Care Team,

Please move my father's neurology visit with Dr. Patel from Tuesday 10:00 AM to Friday 3:00 PM if possible. He uses wheelchair transport through MetroLift — please update the pickup window once the new slot is confirmed.

Thanks,
Priya (daughter / caregiver-CEO)`;

export interface EmailInputProps {
  disabled: boolean;
  isRunning?: boolean;
  onSubmit: (email: string) => void;
}

export function EmailInput({ disabled, isRunning = false, onSubmit }: EmailInputProps) {
  const [text, setText] = useState("");

  const busy = disabled || isRunning;

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="glass-card flex flex-col gap-4 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-cf-muted">
          Inbound signal
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setText(DEMO_EMAIL)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-cf-muted transition hover:border-cf-purple/40 hover:text-cf-text disabled:opacity-40"
          >
            Use demo email
          </button>
          <span className="font-hud text-[10px] text-cf-muted">
            {text.length} chars
            {text.length > MAX_STREAM ? (
              <span className="ml-2 text-cf-amber"> · long payload uses batch mode</span>
            ) : null}
          </span>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        rows={8}
        className="min-h-[11rem] w-full resize-y rounded-xl border border-white/10 bg-[#050B14]/90 px-4 py-3 text-sm leading-relaxed text-cf-text shadow-inner outline-none ring-cf-purple/25 transition-shadow placeholder:text-cf-muted/80 focus:border-cf-purple/45 focus:ring-2 disabled:opacity-50"
        placeholder={DEMO_EMAIL}
      />
      <motion.button
        type="button"
        disabled={busy || !text.trim()}
        onClick={() => onSubmit(text.trim())}
        whileHover={{ scale: busy ? 1 : 1.02 }}
        whileTap={{ scale: busy ? 1 : 0.98 }}
        className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cf-purple via-[#5b52f0] to-[#4a42d8] px-5 py-3 text-sm font-semibold tracking-wide text-white shadow-glow-purple transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isRunning ? (
          <span
            className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/25 border-t-white/90"
            aria-hidden
          />
        ) : null}
        <span className="relative z-10">
          {isRunning ? "Processing…" : "Process Email"}
        </span>
        <motion.span
          className="absolute inset-0 bg-gradient-to-r from-cf-teal/20 to-transparent"
          initial={{ x: "-100%" }}
          whileHover={{ x: busy ? "-100%" : "100%" }}
          transition={{ duration: 0.65 }}
        />
      </motion.button>
    </motion.div>
  );
}
