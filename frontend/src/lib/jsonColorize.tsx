import type { ReactNode } from "react";

/** Lightweight JSON syntax coloring (strings teal, numbers amber, punctuation muted). */
export function colorizeJsonString(s: string): ReactNode[] {
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

export function colorizeJsonValue(value: unknown): ReactNode[] {
  try {
    return colorizeJsonString(JSON.stringify(value, null, 2));
  } catch {
    return [<span key="e">Unable to stringify</span>];
  }
}
