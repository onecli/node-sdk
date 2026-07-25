import {
  OneCLIError,
  OneCLIRequestError,
  toOneCLIError,
} from "../errors.js";
import type {
  Agent,
  AppPermissionDefinition,
  ConnectionAgentAccess,
  CreateAgentInput,
  CreateAgentResponse,
  EffectiveCredentials,
  EnsureAgentResponse,
} from "./types.js";
import type { RequestOptions } from "../request-options.js";

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
  listAgents = async (options?: RequestOptions): Promise<Agent[]> => {
    const url = `${this.baseUrl}/v1/agents`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.buildHeaders(options),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!res.ok) {
        throw new OneCLIRequestError(
          `OneCLI returned ${res.status} ${res.statusText}`,
          { url, statusCode: res.status },
        );
      }

      return (await res.json()) as Agent[];
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
  ): Promise<T> => {
    const url = `${this.baseUrl}${path}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.buildHeaders(options),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!res.ok) {
        throw new OneCLIRequestError(
          `OneCLI returned ${res.status} ${res.statusText}`,
          { url, statusCode: res.status },
        );
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
