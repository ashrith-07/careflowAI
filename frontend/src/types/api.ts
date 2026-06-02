export type WorkflowStatus =
  | "running"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "failed"
  | "completed";

export interface ProcessEmailResponse {
  session_id: string;
  status: WorkflowStatus | string;
  email_analysis: Record<string, unknown> | null;
  memory_context: Record<string, unknown> | null;
  logistics_analysis: Record<string, unknown> | null;
  council_recommendation: Record<string, unknown> | null;
  audit_trail: unknown[];
  errors?: string[];
  current_agent?: string;
}
