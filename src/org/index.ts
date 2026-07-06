import {
  OneCLIError,
  OneCLIRequestError,
  toOneCLIError,
} from "../errors.js";
import { OrgApprovalClient } from "../approvals/org.js";
import type {
  ManualApprovalHandle,
  OrgManualApprovalCallback,
  OrgManualApprovalOptions,
} from "../approvals/types.js";
import type {
  ConnectOrgAppInput,
  CreateOrgRuleInput,
  GetOrgAuthorizeUrlOptions,
  OrgConnection,
  OrgRule,
  UpdateOrgRuleInput,
} from "./types.js";

const CLOUD_OR_ENTERPRISE_HINT =
  "Organization-level resources require OneCLI Cloud or a self-hosted Enterprise instance. See https://onecli.sh for details.";

/**
 * Extract the server's error message/type from either error shape: the
 * envelope `{error:{message,type}}` or the flat `{error:"..."}`.
 */
const parseErrorBody = (
  body: string,
): { message?: string; type?: string } | null => {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; type?: string } | string;
    };
    if (typeof parsed.error === "string") {
      return { message: parsed.error };
    }
    if (parsed.error && typeof parsed.error === "object") {
      return { message: parsed.error.message, type: parsed.error.type };
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Organization-scoped resources: connections and rules shared by every
 * project in the organization. All operations require the admin or owner
 * role.
 *
 * Unlike the project-scoped clients, org requests carry no `X-Project-Id` —
 * the organization is derived from the API key itself (use an organization
 * API key, `oc_org_...`).
 */
export class OrgClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private gatewayUrl: string | null;

  constructor(
    baseUrl: string,
    apiKey: string,
    timeout: number,
    gatewayUrl: string | null = null,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.timeout = timeout;
    this.gatewayUrl = gatewayUrl;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  /**
   * Build the error for a non-ok response. A 404 usually means the org
   * surface doesn't exist on this server (OSS) — but on Cloud/Enterprise an
   * id-addressed call can also 404 on a missing resource
   * (`type: "not_found_error"`); only the route-miss case gets the
   * availability hint.
   */
  private toRequestError(
    url: string,
    status: number,
    statusText: string,
    body: string,
  ): OneCLIError | OneCLIRequestError {
    const parsed = parseErrorBody(body);
    if (status === 404 && parsed?.type !== "not_found_error") {
      return new OneCLIError(CLOUD_OR_ENTERPRISE_HINT);
    }
    const message = parsed?.message
      ? `OneCLI returned ${status}: ${parsed.message}`
      : `OneCLI returned ${status} ${statusText}`;
    return new OneCLIRequestError(message, { url, statusCode: status });
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    try {
      const res = await fetch(url, {
        method,
        headers: this.buildHeaders(),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        throw this.toRequestError(url, res.status, res.statusText, errorBody);
      }

      if (res.status === 204) {
        return undefined as T;
      }
      return (await res.json()) as T;
    } catch (error) {
      if (
        error instanceof OneCLIError ||
        error instanceof OneCLIRequestError
      ) {
        throw error;
      }
      throw toOneCLIError(error);
    }
  }

  /**
   * Connect an app at the organization level with direct credentials
   * (API-key / imported-credential apps). The connection is shared by every
   * project in the organization.
   */
  connectApp = async (
    provider: string,
    input: ConnectOrgAppInput,
  ): Promise<{ success: boolean }> => {
    return this.request<{ success: boolean }>(
      "POST",
      `/v1/org/apps/${encodeURIComponent(provider)}/connect`,
      input,
    );
  };

  /**
   * Start an org-scoped OAuth flow and return the provider's authorize URL.
   * Open the URL in a browser to finish; the resulting connection is created
   * at the organization level.
   *
   * Server-side runtimes only: it relies on `redirect: "manual"` exposing the
   * `Location` header (Node's fetch does; browser fetch returns an opaque
   * redirect and would always throw here).
   */
  getAuthorizeUrl = async (
    provider: string,
    options?: GetOrgAuthorizeUrlOptions,
  ): Promise<string> => {
    const query = options?.connectionId
      ? `?connectionId=${encodeURIComponent(options.connectionId)}`
      : "";
    const url = `${this.baseUrl}/v1/org/apps/${encodeURIComponent(provider)}/authorize${query}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.buildHeaders(),
        redirect: "manual",
        signal: AbortSignal.timeout(this.timeout),
      });

      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        return location;
      }

      const errorBody = await res.text().catch(() => "");
      if (res.status >= 400) {
        throw this.toRequestError(url, res.status, res.statusText, errorBody);
      }
      throw new OneCLIRequestError(
        `OneCLI returned ${res.status} ${res.statusText} instead of an authorize redirect`,
        { url, statusCode: res.status },
      );
    } catch (error) {
      if (
        error instanceof OneCLIError ||
        error instanceof OneCLIRequestError
      ) {
        throw error;
      }
      throw toOneCLIError(error);
    }
  };

  /**
   * List the organization's app connections, optionally filtered by provider.
   */
  listConnections = async (provider?: string): Promise<OrgConnection[]> => {
    const query = provider
      ? `?provider=${encodeURIComponent(provider)}`
      : "";
    return this.request<OrgConnection[]>("GET", `/v1/org/connections${query}`);
  };

  /**
   * Rename an organization connection.
   */
  renameConnection = async (
    connectionId: string,
    label: string,
  ): Promise<OrgConnection> => {
    return this.request<OrgConnection>(
      "PATCH",
      `/v1/org/connections/${encodeURIComponent(connectionId)}`,
      { label },
    );
  };

  /**
   * Delete an organization connection.
   */
  deleteConnection = async (connectionId: string): Promise<void> => {
    await this.request<undefined>(
      "DELETE",
      `/v1/org/connections/${encodeURIComponent(connectionId)}`,
    );
  };

  /**
   * List the organization's policy rules (applied to every agent in the org).
   */
  listRules = async (): Promise<OrgRule[]> => {
    return this.request<OrgRule[]>("GET", "/v1/org/rules");
  };

  /**
   * Get a single organization rule.
   */
  getRule = async (ruleId: string): Promise<OrgRule> => {
    return this.request<OrgRule>(
      "GET",
      `/v1/org/rules/${encodeURIComponent(ruleId)}`,
    );
  };

  /**
   * Create an organization rule.
   */
  createRule = async (input: CreateOrgRuleInput): Promise<OrgRule> => {
    return this.request<OrgRule>("POST", "/v1/org/rules", input);
  };

  /**
   * Update an organization rule. Nullable fields accept an explicit `null`
   * to clear the stored value.
   */
  updateRule = async (
    ruleId: string,
    input: UpdateOrgRuleInput,
  ): Promise<{ success: boolean }> => {
    return this.request<{ success: boolean }>(
      "PATCH",
      `/v1/org/rules/${encodeURIComponent(ruleId)}`,
      input,
    );
  };

  /**
   * Delete an organization rule.
   */
  deleteRule = async (ruleId: string): Promise<void> => {
    await this.request<undefined>(
      "DELETE",
      `/v1/org/rules/${encodeURIComponent(ruleId)}`,
    );
  };

  /**
   * Register a callback for manual approval requests across **every** project
   * in the organization. Starts background long-polling to the gateway; the
   * callback is invoked once per pending request (concurrently), each carrying
   * its `projectId`, and each decision is routed back to that project. Returns
   * a handle to stop polling when shutting down.
   *
   * Requires an organization API key (`oc_org_...`) and OneCLI Cloud or a
   * self-hosted Enterprise instance.
   */
  configureManualApproval = (
    callback: OrgManualApprovalCallback,
    options?: OrgManualApprovalOptions,
  ): ManualApprovalHandle => {
    const client = new OrgApprovalClient(
      this.baseUrl,
      this.apiKey,
      this.gatewayUrl,
    );
    client.start(callback, options).catch(() => {
      // Poll errors surface via options.onError and retry with backoff.
    });
    return { stop: () => client.stop() };
  };
}
