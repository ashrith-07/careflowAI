import { motion } from "framer-motion";
import { useState } from "react";

const MAX_STREAM = 1800;

export interface EmailInputProps {
  disabled: boolean;
  onSubmit: (email: string) => void;
}

export function EmailInput({ disabled, onSubmit }: EmailInputProps) {
  const [text, setText] = useState(
    "Subject: Reschedule\n\nPlease move Father's neurology visit with Dr. Patel from Tuesday 10:00 to Friday 15:00. Update wheelchair transport accordingly.",
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="glass-card flex flex-col gap-4 p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-cf-muted">
          Inbound signal
        </h2>
        <span className="font-hud text-[10px] text-cf-muted">
          {text.length} chars
          {text.length > MAX_STREAM ? (
            <span className="ml-2 text-cf-amber"> · long payload uses batch mode</span>
          ) : null}
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        rows={12}
        className="min-h-[220px] w-full resize-y rounded-xl border border-white/10 bg-[#0A1628]/80 px-4 py-3 text-sm leading-relaxed text-cf-text outline-none ring-cf-purple/30 transition-shadow placeholder:text-cf-muted focus:border-cf-purple/40 focus:ring-2 disabled:opacity-50"
        placeholder="Paste clinic email, transport notice, or family coordination thread…"
      />
      <motion.button
        type="button"
        disabled={disabled || !text.trim()}
        onClick={() => onSubmit(text.trim())}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-cf-purple to-[#5548e8] px-5 py-3 text-sm font-semibold tracking-wide text-white shadow-glow-purple transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="relative z-10">
          {disabled ? "Processing…" : "Execute multi-agent analysis"}
        </span>
        <motion.span
          className="absolute inset-0 bg-gradient-to-r from-cf-teal/25 to-transparent"
          initial={{ x: "-100%" }}
          whileHover={{ x: "100%" }}
          transition={{ duration: 0.6 }}
        />
      </motion.button>
    </motion.div>
  );
}
