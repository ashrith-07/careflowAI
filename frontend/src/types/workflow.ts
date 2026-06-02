/** API + UI workflow types */

export type PipelineStatus =
  | "idle"
  | "running"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "failed";

export interface WorkflowResult {
  session_id: string;
  status: string;
  email_analysis: Record<string, unknown> | null;
  memory_context: Record<string, unknown> | null;
  logistics_analysis: Record<string, unknown> | null;
  council_recommendation: Record<string, unknown> | null;
  audit_trail: unknown[];
  errors?: string[];
  current_agent?: string;
}

export type StreamEvent =
  | {
      type: "agent_started";
      agent: string;
      session_id?: string;
      at: number;
      raw?: unknown;
    }
  | {
      type: "agent_completed";
      agent: string;
      updates: Record<string, unknown>;
      at: number;
      raw?: unknown;
    }
  | { type: "workflow_completed"; result: WorkflowResult; at: number }
  | {
      type: "workflow_failed";
      errors?: string[];
      error?: string;
      result?: WorkflowResult | null;
      failed_at_agent?: string;
      at: number;
    }
  | { type: "error"; detail: string; at: number };

export interface AuditEntry {
  id: number;
  session_id: string;
  agent_name: string;
  input_data: unknown;
  output_data: unknown;
  duration_ms: number;
  timestamp: string;
}

export interface SessionDetail {
  id: string;
  email_content: string;
  status: string;
  result_data: WorkflowResult | Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  audit_log?: AuditEntry[];
}
