import { OneCLIRequestError } from "../errors.js";
import type {
  OrgApprovalRequest,
  OrgManualApprovalCallback,
  OrgManualApprovalOptions,
} from "./types.js";

/** Internal response shape from the org-scoped long-poll endpoint. */
interface OrgPollResponse {
  requests: OrgApprovalRequest[];
  timeoutSeconds: number;
}

/**
 * Long-polls the gateway for pending approvals across **every** project in the
 * organization (`GET /v1/org/approvals/pending`) — a cross-project sibling of
 * `ApprovalClient`. Authenticates with an organization API key (`oc_org_...`)
 * and sends **no** `X-Project-Id` on the poll; each returned request carries its
 * own `projectId`, which is echoed back as `X-Project-Id` on the decision so the
 * gateway routes it to the right project (reusing the existing decision route).
 */
export class OrgApprovalClient {
  private baseUrl: string;
  private apiKey: string;
  private gatewayUrl: string | null;
  private running = false;
  private abortController: AbortController | null = null;

  /**
   * Approval IDs currently being processed by a callback. Prevents duplicate
   * callback invocations when the poll returns a request again before its
   * decision is submitted.
   */
  private inFlight = new Set<string>();

  constructor(baseUrl: string, apiKey: string, gatewayUrl: string | null) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.gatewayUrl = gatewayUrl;
  }

  /**
   * Auth headers for org requests. The poll sends only the bearer token — the
   * organization is derived from the key. A decision additionally carries the
   * request's `projectId` as `X-Project-Id` so it lands in the right project.
   */
  private buildAuthHeaders(projectId?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (projectId) {
      headers["X-Project-Id"] = projectId;
    }
    return headers;
  }

  /** Resolve the gateway URL from the web app. Called once, then cached. */
  private async resolveGatewayUrl(): Promise<string> {
    if (this.gatewayUrl) return this.gatewayUrl;

    const url = `${this.baseUrl}/v1/gateway-url`;
    const res = await fetch(url, {
      headers: this.buildAuthHeaders(),
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
   * Start the long-polling loop. Runs until stop() is called. Dispatches
   * callbacks concurrently, one per pending approval. On a failed poll cycle the
   * error is passed to `options.onError` (if given) and the loop backs off and
   * retries — unlike the project client, it does not swallow errors silently.
   */
  async start(
    callback: OrgManualApprovalCallback,
    options?: OrgManualApprovalOptions,
  ): Promise<void> {
    this.running = true;

    while (this.running) {
      try {
        // Resolve inside the loop so a gateway-URL resolution failure also
        // routes to `onError` and backs off (not just poll failures). It
        // caches on success, so this is a cheap guard after the first poll.
        const gatewayUrl = await this.resolveGatewayUrl();
        const poll = await this.poll(gatewayUrl);

        for (const request of poll.requests) {
          this.inFlight.add(request.id);
          request.timeoutSeconds = poll.timeoutSeconds;

          this.handleRequest(gatewayUrl, request, callback);
        }
      } catch (error) {
        if (!this.running) return;
        options?.onError?.(error);
        await this.sleep(5000);
      }
    }
  }

  /**
   * Process a single approval: call the callback, submit the decision back to
   * the request's own project. Runs independently (concurrent). On any failure,
   * removes from inFlight so the next poll retries.
   */
  private handleRequest(
    gatewayUrl: string,
    request: OrgApprovalRequest,
    callback: OrgManualApprovalCallback,
  ): void {
    (async () => {
      try {
        const decision = await callback(request);
        await this.submitDecision(
          gatewayUrl,
          request.id,
          decision,
          request.projectId,
        );
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
   * Long-poll the gateway for pending approvals across the org.
   * Server holds up to 30s; we set a 35s client timeout.
   */
  private async poll(gatewayUrl: string): Promise<OrgPollResponse> {
    this.abortController = new AbortController();

    let url = `${gatewayUrl}/v1/org/approvals/pending`;
    if (this.inFlight.size > 0) {
      const exclude = [...this.inFlight].join(",");
      url += `?exclude=${encodeURIComponent(exclude)}`;
    }
    const res = await fetch(url, {
      headers: this.buildAuthHeaders(),
      signal: AbortSignal.any([
        this.abortController.signal,
        AbortSignal.timeout(35_000),
      ]),
    });

    if (!res.ok) {
      throw new OneCLIRequestError("Org approval poll failed", {
        url,
        statusCode: res.status,
      });
    }

    return (await res.json()) as OrgPollResponse;
  }

  /** Submit a decision for a single approval, scoped to its own project. */
  private async submitDecision(
    gatewayUrl: string,
    id: string,
    decision: string,
    projectId: string,
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
