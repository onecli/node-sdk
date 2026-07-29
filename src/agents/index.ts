import {
  OneCLIError,
  OneCLIRequestError,
  toOneCLIError,
} from "../errors.js";
import type {
  Agent,
  AgentGrants,
  AgentWithGrantsSummary,
  AppPermissionDefinition,
  ConnectionAgentAccess,
  ConnectionGrantInput,
  ConnectionGrants,
  EffectiveAppPermissions,
  CreateAgentInput,
  CreateAgentResponse,
  EffectiveCredentials,
  EnsureAgentResponse,
} from "./types.js";
import type { RequestOptions } from "../request-options.js";

/** Extract the server error-envelope message from a response body, if any. */
const parseErrorEnvelope = (body: string): string | null => {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string } | string;
    };
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error && typeof parsed.error.message === "string") {
      return parsed.error.message;
    }
    return null;
  } catch {
    return null;
  }
};

export class AgentsClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private defaultProjectId: string | null;

  constructor(
    baseUrl: string,
    apiKey: string,
    timeout: number,
    defaultProjectId: string | null,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.timeout = timeout;
    this.defaultProjectId = defaultProjectId;
  }

  private buildHeaders(options?: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    const projectId = options?.projectId ?? this.defaultProjectId;
    if (projectId) {
      headers["X-Project-Id"] = projectId;
    }
    return headers;
  }

  /**
   * Create a new agent.
   */
  createAgent = async (
    input: CreateAgentInput,
    options?: RequestOptions,
  ): Promise<CreateAgentResponse> => {
    const url = `${this.baseUrl}/v1/agents`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.buildHeaders(options),
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!res.ok) {
        throw new OneCLIRequestError(
          `OneCLI returned ${res.status} ${res.statusText}`,
          { url, statusCode: res.status },
        );
      }

      return (await res.json()) as CreateAgentResponse;
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
   * List all agents in the project.
   */
  listAgents = async (options?: RequestOptions): Promise<Agent[]> =>
    this.request<Agent[]>("GET", "/v1/agents", undefined, options);

  /**
   * List all agents with each one's attach summary — its granted connections,
   * secrets, and LLM keys (`GET /v1/agents?include=grants-summary`).
   */
  listAgentsWithGrants = async (
    options?: RequestOptions,
  ): Promise<AgentWithGrantsSummary[]> =>
    this.request<AgentWithGrantsSummary[]>(
      "GET",
      "/v1/agents?include=grants-summary",
      undefined,
      options,
    );

  /**
   * Shared request path. Non-2xx responses surface the server's error-envelope
   * message when one exists (`{ error: { message } }` or `{ error: "..." }`) —
   * a 410's pointer at the replacement endpoint, a 422's validation law —
   * instead of a bare status line. 204 responses resolve to undefined.
   */
  private request = async <T>(
    method: "GET" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> => {
    const url = `${this.baseUrl}${path}`;

    try {
      const res = await fetch(url, {
        method,
        headers: this.buildHeaders(options),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!res.ok) {
        const detail = parseErrorEnvelope(await res.text().catch(() => ""));
        throw new OneCLIRequestError(
          detail ?? `OneCLI returned ${res.status} ${res.statusText}`,
          { url, statusCode: res.status },
        );
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
  };

  /**
   * Shared GET for the read-only reflections. Mirrors `listAgents`' error
   * handling so every method on this client fails the same way.
   */
  private getJson = async <T>(
    path: string,
    options?: RequestOptions,
  ): Promise<T> => this.request<T>("GET", path, undefined, options);

  /**
   * The agent's grants: its attached app connections (with per-tool access)
   * and secrets. Grants are attach INTENT — `getEffectiveCredentials` is the
   * effective view with organization guardrails applied.
   */
  getAgentGrants = async (
    agentId: string,
    options?: RequestOptions,
  ): Promise<AgentGrants> =>
    this.request<AgentGrants>(
      "GET",
      `/v1/agents/${encodeURIComponent(agentId)}/grants`,
      undefined,
      options,
    );

  /**
   * Attach an app connection to the agent, or replace its per-tool access.
   * Returns the agent's fresh grant set. Idempotent — an identical desired
   * state writes nothing and still returns 200.
   */
  setConnectionGrant = async (
    agentId: string,
    connectionId: string,
    input: ConnectionGrantInput,
    options?: RequestOptions,
  ): Promise<AgentGrants> =>
    this.request<AgentGrants>(
      "PUT",
      `/v1/agents/${encodeURIComponent(agentId)}/grants/connections/${encodeURIComponent(connectionId)}`,
      input,
      options,
    );

  /**
   * Detach an app connection from the agent (204; resolves to void). Also the
   * only way to express "no tools at all" — the server rejects an all-blocked
   * custom grant with 422.
   */
  removeConnectionGrant = async (
    agentId: string,
    connectionId: string,
    options?: RequestOptions,
  ): Promise<void> =>
    this.request<void>(
      "DELETE",
      `/v1/agents/${encodeURIComponent(agentId)}/grants/connections/${encodeURIComponent(connectionId)}`,
      undefined,
      options,
    );

  /**
   * Attach a secret or LLM key to the agent. Secrets have no per-tool axis —
   * the PUT takes no body. Returns the agent's fresh grant set.
   */
  attachSecret = async (
    agentId: string,
    secretId: string,
    options?: RequestOptions,
  ): Promise<AgentGrants> =>
    this.request<AgentGrants>(
      "PUT",
      `/v1/agents/${encodeURIComponent(agentId)}/grants/secrets/${encodeURIComponent(secretId)}`,
      undefined,
      options,
    );

  /** Detach a secret from the agent (204; resolves to void). */
  detachSecret = async (
    agentId: string,
    secretId: string,
    options?: RequestOptions,
  ): Promise<void> =>
    this.request<void>(
      "DELETE",
      `/v1/agents/${encodeURIComponent(agentId)}/grants/secrets/${encodeURIComponent(secretId)}`,
      undefined,
      options,
    );

  /**
   * Which agents a connection is granted to (attach intent, read-only).
   * The connection-side writes are the same server operations as
   * `setConnectionGrant`/`removeConnectionGrant` — use those.
   */
  getConnectionGrants = async (
    connectionId: string,
    options?: RequestOptions,
  ): Promise<ConnectionGrants> =>
    this.request<ConnectionGrants>(
      "GET",
      `/v1/connections/${encodeURIComponent(connectionId)}/grants`,
      undefined,
      options,
    );

  /**
   * Which credentials this agent can actually use, and what each one can do
   * under the published policy.
   *
   * Replaces the retired `GET /v1/agents/:id/{secrets,connections}` reads. Those
   * returned a stored assignment list; this returns the EFFECTIVE set, so a
   * credential granted by a policy rule appears here even though no assignment
   * row exists for it.
   */
  getEffectiveCredentials = async (
    agentId: string,
    options?: RequestOptions,
  ): Promise<EffectiveCredentials> =>
    this.getJson<EffectiveCredentials>(
      `/v1/agents/${encodeURIComponent(agentId)}/effective-credentials`,
      options,
    );

  /**
   * What the project's published policy allows for an app, per tool. Omit
   * `agentId` for the all-agents baseline.
   *
   * The project-scope twin of `org.getEffectiveAppPermissions`, and the
   * replacement for the retired `/v1/rules/permissions/:provider`.
   */
  getEffectiveAppPermissions = async (
    input: { provider: string; agentId?: string },
    options?: RequestOptions,
  ): Promise<EffectiveAppPermissions> => {
    const query = new URLSearchParams({ provider: input.provider });
    if (input.agentId) query.set("agentId", input.agentId);
    return this.getJson<EffectiveAppPermissions>(
      `/v1/policy/effective-app-permissions?${query.toString()}`,
      options,
    );
  };

  /**
   * Which agents can reach a connection, and what each can do with it.
   *
   * Replaces the retired `GET /v1/connections/:id/agents`.
   */
  getConnectionAgentAccess = async (
    connectionId: string,
    options?: RequestOptions,
  ): Promise<ConnectionAgentAccess> =>
    this.getJson<ConnectionAgentAccess>(
      `/v1/connections/${encodeURIComponent(connectionId)}/effective-agents`,
      options,
    );

  /**
   * Every provider's public tool catalog — the tool ids an app-target policy
   * rule can name. Global data; no project context required.
   */
  listAppPermissionDefinitions = async (
    options?: RequestOptions,
  ): Promise<AppPermissionDefinition[]> =>
    this.getJson<AppPermissionDefinition[]>(
      "/v1/apps/permission-definitions",
      options,
    );

  /**
   * Whether an agent with the given identifier already exists in the project.
   * Swallows lookup failures and returns `false` so callers can fall back to
   * surfacing their original error when existence can't be confirmed.
   */
  private agentExists = async (
    identifier: string,
    options?: RequestOptions,
  ): Promise<boolean> => {
    try {
      const agents = await this.listAgents(options);
      return agents.some((a) => a.identifier === identifier);
    } catch {
      return false;
    }
  };

  /**
   * Ensure an agent exists. Creates it if missing, returns normally if it already exists.
   * Unlike `createAgent`, this method treats a 409 conflict as success.
   */
  ensureAgent = async (
    input: CreateAgentInput,
    options?: RequestOptions,
  ): Promise<EnsureAgentResponse> => {
    try {
      await this.createAgent(input, options);
      return { name: input.name, identifier: input.identifier, created: true };
    } catch (error) {
      if (error instanceof OneCLIRequestError && error.statusCode === 409) {
        return {
          name: input.name,
          identifier: input.identifier,
          created: false,
        };
      }
      // At the agent cap the server may evaluate the quota before the
      // identifier-uniqueness check and return 403 where it would otherwise
      // return 409 for an existing identifier. Re-creating an existing agent is
      // a no-op, so confirm existence and treat it as success; only surface the
      // quota error when the agent genuinely doesn't exist. See issue #40.
      if (error instanceof OneCLIRequestError && error.statusCode === 403) {
        if (await this.agentExists(input.identifier, options)) {
          return {
            name: input.name,
            identifier: input.identifier,
            created: false,
          };
        }
      }
      throw error;
    }
  };
}
