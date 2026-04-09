/** A single request awaiting manual approval. */
export interface ApprovalRequest {
  /** Unique approval ID. */
  id: string;
  /** HTTP method (e.g., "POST", "DELETE"). */
  method: string;
  /** Full URL (e.g., "https://api.example.com/v1/send"). */
  url: string;
  /** Hostname (e.g., "api.example.com"). */
  host: string;
  /** Request path (e.g., "/v1/send"). */
  path: string;
  /** Sanitized request headers (no auth headers). */
  headers: Record<string, string>;
  /** First ~4KB of request body as text, or null if no body. */
  bodyPreview: string | null;
  /** The agent that made this request. */
  agent: { id: string; name: string };
  /** When the request arrived (ISO 8601). */
  createdAt: string;
  /** When the approval expires (ISO 8601). */
  expiresAt: string;
  /** Approval timeout in seconds (how long until auto-deny). */
  timeoutSeconds: number;
}

/**
 * Callback invoked once per approval request.
 * Return `'approve'` to forward the request, `'deny'` to block it.
 *
 * The SDK calls this concurrently for multiple pending approvals —
 * each invocation is independent. If the callback throws or the
 * decision fails to submit, the same request will be retried on
 * the next poll cycle.
 */
export type ManualApprovalCallback = (
  request: ApprovalRequest,
) => Promise<"approve" | "deny">;

/** Handle returned by configureManualApproval() to stop polling. */
export interface ManualApprovalHandle {
  /** Stop polling and disconnect. */
  stop: () => void;
}
