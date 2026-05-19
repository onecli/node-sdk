import { OneCLIRequestError } from "../errors.js";
import type { ApprovalRequest, ManualApprovalCallback } from "./types.js";
import type { RequestOptions } from "../request-options.js";

/** Internal response shape from the gateway long-poll endpoint. */
interface PollResponse {
  requests: ApprovalRequest[];
  timeoutSeconds: number;
}

export class ApprovalClient {
  private baseUrl: string;
  private apiKey: string;
  private gatewayUrl: string | null;
  private defaultProjectId: string | null;
  private running = false;
  private abortController: AbortController | null = null;

  /**
   * Tracks approval IDs currently being processed by a callback.
   * Prevents duplicate callback invocations for the same request
   * when the poll returns it again before the decision is submitted.
   */
  private inFlight = new Set<string>();

  constructor(
    baseUrl: string,
    apiKey: string,
    gatewayUrl: string | null,
    defaultProjectId: string | null,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.gatewayUrl = gatewayUrl;
    this.defaultProjectId = defaultProjectId;
  }

  private buildAuthHeaders(projectId?: string | null): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    const resolved = projectId ?? this.defaultProjectId;
    if (resolved) {
      headers["X-Project-Id"] = resolved;
    }
    return headers;
  }

  /**
   * Resolve the gateway URL from the web app.
   * Called once on first poll, then cached.
   */
  private async resolveGatewayUrl(
    projectId?: string | null,
  ): Promise<string> {
    if (this.gatewayUrl) return this.gatewayUrl;

    const url = `${this.baseUrl}/v1/gateway-url`;
    const res = await fetch(url, {
      headers: this.buildAuthHeaders(projectId),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new OneCLIRequestError("Failed to resolve gateway URL", {
        url,
        statusCode: res.status,
      });
    }

    const data = (await res.json()) as { url: string };
    this.gatewayUrl = data.url.replace(/\/+$/, "");
    return this.gatewayUrl;
  }

  /**
   * Start the long-polling loop. Runs until stop() is called.
   *
   * Dispatches callbacks concurrently — multiple approvals are handled
   * in parallel without blocking each other or the polling loop.
   * Each approval ID is tracked in `inFlight` to prevent duplicate
   * callback invocations. On failure (callback throws or decision
   * submission fails), the ID is removed from `inFlight` and the
   * approval will be retried on the next poll cycle.
   */
  async start(
    callback: ManualApprovalCallback,
    options?: RequestOptions,
  ): Promise<void> {
    this.running = true;
    const projectId = options?.projectId ?? null;
    const gatewayUrl = await this.resolveGatewayUrl(projectId);

    while (this.running) {
      try {
        const poll = await this.poll(gatewayUrl, projectId);

        for (const request of poll.requests) {
          this.inFlight.add(request.id);
          request.timeoutSeconds = poll.timeoutSeconds;

          this.handleRequest(gatewayUrl, request, callback, projectId);
        }
      } catch {
        if (!this.running) return;
        await this.sleep(5000);
      }
    }
  }

  /**
   * Process a single approval: call the callback, submit the decision.
   * Runs independently — multiple calls execute concurrently.
   * On any failure, removes from inFlight so the next poll retries.
   */
  private handleRequest(
    gatewayUrl: string,
    request: ApprovalRequest,
    callback: ManualApprovalCallback,
    projectId?: string | null,
  ): void {
    (async () => {
      try {
        const decision = await callback(request);
        await this.submitDecision(gatewayUrl, request.id, decision, projectId);
      } finally {
        this.inFlight.delete(request.id);
      }
    })().catch(() => {
      this.inFlight.delete(request.id);
    });
  }

  /** Stop the polling loop and abort any in-flight poll request. */
  stop(): void {
    this.running = false;
    this.abortController?.abort();
  }

  /**
   * Long-poll the gateway for pending approvals.
   * Server holds up to 30s; we set a 35s client timeout.
   */
  private async poll(
    gatewayUrl: string,
    projectId?: string | null,
  ): Promise<PollResponse> {
    this.abortController = new AbortController();

    let url = `${gatewayUrl}/v1/approvals/pending`;
    if (this.inFlight.size > 0) {
      const exclude = [...this.inFlight].join(",");
      url += `?exclude=${encodeURIComponent(exclude)}`;
    }
    const res = await fetch(url, {
      headers: this.buildAuthHeaders(projectId),
      signal: AbortSignal.any([
        this.abortController.signal,
        AbortSignal.timeout(35_000),
      ]),
    });

    if (!res.ok) {
      throw new OneCLIRequestError("Approval poll failed", {
        url,
        statusCode: res.status,
      });
    }

    return (await res.json()) as PollResponse;
  }

  /** Submit a decision for a single approval request. */
  private async submitDecision(
    gatewayUrl: string,
    id: string,
    decision: string,
    projectId?: string | null,
  ): Promise<void> {
    const url = `${gatewayUrl}/v1/approvals/${encodeURIComponent(id)}/decision`;

    const headers = this.buildAuthHeaders(projectId);
    headers["Content-Type"] = "application/json";

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ decision }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok && res.status !== 410) {
      throw new OneCLIRequestError("Decision submission failed", {
        url,
        statusCode: res.status,
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
