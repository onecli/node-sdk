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
  CreateOrgPolicyRuleInput,
  CreateOrgRuleInput,
  GetOrgAuthorizeUrlOptions,
  OrgConnection,
  OrgPolicyRule,
  OrgRule,
  PolicyLastPublish,
  PolicyPublishResult,
  PolicyRuleAction,
  PolicyRuleStatus,
  PolicyWriteOptions,
  PolicyWriteResult,
  UpdateOrgPolicyRuleInput,
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
   *
   * @deprecated Cloud deployments reject this write with 410 Gone — use
   * {@link createPolicyRule}. Pre-cutover self-hosted servers still accept it.
   */
  createRule = async (input: CreateOrgRuleInput): Promise<OrgRule> => {
    return this.request<OrgRule>("POST", "/v1/org/rules", input);
  };

  /**
   * Update an organization rule. Nullable fields accept an explicit `null`
   * to clear the stored value.
   *
   * @deprecated Cloud deployments reject this write with 410 Gone — use
   * {@link updatePolicyRule}. Pre-cutover self-hosted servers still accept it.
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
   *
   * @deprecated Cloud deployments reject this write with 410 Gone — use
   * {@link deletePolicyRule}. Pre-cutover self-hosted servers still accept it.
   */
  deleteRule = async (ruleId: string): Promise<void> => {
    await this.request<undefined>(
      "DELETE",
      `/v1/org/rules/${encodeURIComponent(ruleId)}`,
    );
  };

  // ── The policy engine (staged draft → publish) ────────────────────────────
  //
  // Writes land in the org's DRAFT and enforce only after a publish. By
  // default each write method publishes immediately; note a publish
  // snapshots the WHOLE org draft — including changes staged by other users
  // — so pass `{ skipPublish: true }` and call `publishPolicy()` explicitly
  // when several people edit policy. If the publish step fails after a
  // successful write, the write IS staged and the PUBLISH request's error is
  // rethrown unchanged (its `url` ends with `/publish`) — do NOT retry the
  // write (that would stage a duplicate); inspect via
  // `listPolicyRules("draft")` and retry `publishPolicy()` instead.

  /**
   * List the organization's policy-engine rules — the DRAFT working copy by
   * default, or the enforced set with `"published"`.
   */
  listPolicyRules = async (
    status: PolicyRuleStatus = "draft",
  ): Promise<OrgPolicyRule[]> => {
    return this.request<OrgPolicyRule[]>(
      "GET",
      `/v1/org/policy/rules?status=${status}`,
    );
  };

  /**
   * Get one DRAFT policy rule. Published row ids regenerate on every
   * publish — list with `"published"` and match by `logicalId` instead.
   */
  getPolicyRule = async (ruleId: string): Promise<OrgPolicyRule> => {
    return this.request<OrgPolicyRule>(
      "GET",
      `/v1/org/policy/rules/${encodeURIComponent(ruleId)}`,
    );
  };

  /**
   * Create a policy rule (and publish, unless `skipPublish`).
   */
  createPolicyRule = async (
    input: CreateOrgPolicyRuleInput,
    options?: PolicyWriteOptions,
  ): Promise<PolicyWriteResult<OrgPolicyRule>> => {
    const rule = await this.request<OrgPolicyRule>(
      "POST",
      "/v1/org/policy/rules",
      input,
    );
    return this.finishPolicyWrite(rule, options);
  };

  /**
   * Update a DRAFT policy rule (and publish, unless `skipPublish`).
   */
  updatePolicyRule = async (
    ruleId: string,
    input: UpdateOrgPolicyRuleInput,
    options?: PolicyWriteOptions,
  ): Promise<PolicyWriteResult<OrgPolicyRule>> => {
    const rule = await this.request<OrgPolicyRule>(
      "PATCH",
      `/v1/org/policy/rules/${encodeURIComponent(ruleId)}`,
      input,
    );
    return this.finishPolicyWrite(rule, options);
  };

  /**
   * Delete a DRAFT policy rule (and publish, unless `skipPublish`).
   */
  deletePolicyRule = async (
    ruleId: string,
    options?: PolicyWriteOptions,
  ): Promise<PolicyWriteResult<null>> => {
    await this.request<undefined>(
      "DELETE",
      `/v1/org/policy/rules/${encodeURIComponent(ruleId)}`,
    );
    return this.finishPolicyWrite(null, options);
  };

  /**
   * Reorder the DRAFT (and publish, unless `skipPublish`). `orderedIds`
   * must name EVERY non-default draft rule exactly once — take the full
   * list from `listPolicyRules("draft")`; the server rejects a partial
   * permutation with 409.
   */
  reorderPolicyRules = async (
    orderedIds: string[],
    options?: PolicyWriteOptions,
  ): Promise<PolicyWriteResult<OrgPolicyRule[]>> => {
    const rules = await this.request<OrgPolicyRule[]>(
      "PUT",
      "/v1/org/policy/rules/order",
      { orderedIds },
    );
    return this.finishPolicyWrite(rules, options);
  };

  /**
   * Get the organization's terminal Default Rule (a virtual default is
   * returned when none is persisted yet).
   */
  getPolicyDefault = async (
    status: PolicyRuleStatus = "draft",
  ): Promise<OrgPolicyRule> => {
    return this.request<OrgPolicyRule>(
      "GET",
      `/v1/org/policy/default?status=${status}`,
    );
  };

  /**
   * Set the Default Rule's action (and publish, unless `skipPublish`).
   */
  setPolicyDefault = async (
    action: PolicyRuleAction,
    options?: PolicyWriteOptions,
  ): Promise<PolicyWriteResult<OrgPolicyRule>> => {
    const rule = await this.request<OrgPolicyRule>(
      "PATCH",
      "/v1/org/policy/default",
      { action },
    );
    return this.finishPolicyWrite(rule, options);
  };

  /**
   * Publish the WHOLE org draft — every staged change, including other
   * users' — into a new enforced generation.
   */
  publishPolicy = async (): Promise<PolicyPublishResult> => {
    return this.request<PolicyPublishResult>(
      "POST",
      "/v1/org/policy/publish",
      {},
    );
  };

  /**
   * The most recent publish, or `null` when the org was never published.
   */
  getPolicyLastPublish = async (): Promise<PolicyLastPublish | null> => {
    return this.request<PolicyLastPublish | null>(
      "GET",
      "/v1/org/policy/last-publish",
    );
  };

  /** Complete a policy write per the publish option (see the section note). */
  private finishPolicyWrite = async <T>(
    result: T,
    options?: PolicyWriteOptions,
  ): Promise<PolicyWriteResult<T>> => {
    if (options?.skipPublish) {
      return { result, published: false, generation: null };
    }
    const publish = await this.publishPolicy();
    return { result, published: true, generation: publish.generation };
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
