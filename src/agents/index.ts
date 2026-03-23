import {
  OneCLIError,
  OneCLIRequestError,
  toOneCLIError,
} from "../errors.js";
import type {
  CreateAgentInput,
  CreateAgentResponse,
  EnsureAgentResponse,
} from "./types.js";

export class AgentsClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(baseUrl: string, apiKey: string, timeout: number) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.timeout = timeout;
  }

  /**
   * Create a new agent.
   */
  createAgent = async (
    input: CreateAgentInput,
  ): Promise<CreateAgentResponse> => {
    const url = `${this.baseUrl}/api/agents`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
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
   * Ensure an agent exists. Creates it if missing, returns normally if it already exists.
   * Unlike `createAgent`, this method treats a 409 conflict as success.
   */
  ensureAgent = async (
    input: CreateAgentInput,
  ): Promise<EnsureAgentResponse> => {
    try {
      await this.createAgent(input);
      return { name: input.name, identifier: input.identifier, created: true };
    } catch (error) {
      if (error instanceof OneCLIRequestError && error.statusCode === 409) {
        return {
          name: input.name,
          identifier: input.identifier,
          created: false,
        };
      }
      throw error;
    }
  };
}
