/** One key fact about a held request, e.g. `{ label: "To", value: "a@b.com" }`. */
export interface ApprovalDetail {
  /** Field name shown to the approver (e.g. "To", "Subject"). */
  label: string;
  /** Field value shown to the approver. */
  value: string;
}

/**
 * Structured, human-readable description of what a held request will do.
 *
 * The gateway decodes this from the (often opaque) request body — e.g. a Gmail
 * send's base64 MIME becomes `{ action: "Send email", details: [...] }` — so it
 * can be rendered as fields/rows instead of raw bytes.
 */
export interface ApprovalSummary {
  /** Short action title, e.g. "Send email" or "Delete calendar event". */
  action: string;
  /** Ordered key facts about the request. */
  details: ApprovalDetail[];
}

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
  /**
   * Human-readable, length-bounded rendering of the request as plain text —
   * safe to display directly (never raw base64/binary). Mirrors `summary`
   * flattened to text; `null` only when there is nothing to summarize.
   */
  bodyPreview: string | null;
  /**
   * Structured form of `bodyPreview` for richer rendering (render
   * `summary.details` as fields/rows). Absent on older gateways, or `null`
   * when no summary is available — fall back to `bodyPreview`.
   */
  summary?: ApprovalSummary | null;
  /** The agent that made this request. */
  agent: { id: string; name: string; externalId: string | null };
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

/**
 * An approval request from the organization-scoped poll. Identical to
 * {@link ApprovalRequest} but carries the `projectId` of the project it belongs
 * to — a single org handler spans every project, so each decision is routed
 * back to the right one.
 */
export interface OrgApprovalRequest extends ApprovalRequest {
  /** The project this request belongs to. */
  projectId: string;
}

/**
 * Callback invoked once per organization-scoped approval request. Like
 * {@link ManualApprovalCallback}, but the request carries its `projectId`.
 */
export type OrgManualApprovalCallback = (
  request: OrgApprovalRequest,
) => Promise<"approve" | "deny">;

/** Options for `onecli.org.configureManualApproval()`. */
export interface OrgManualApprovalOptions {
  /**
   * Called when a poll cycle fails (auth, network, or gateway-URL resolution).
   * The loop backs off and retries either way; without a handler these errors
   * are swallowed silently.
   */
  onError?: (error: unknown) => void;
}
