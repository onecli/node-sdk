import {
  OneCLIError,
  OneCLIRequestError,
  toOneCLIError,
} from "../errors.js";
import type { ProvisionProjectInput, ProvisionProjectResponse } from "./types.js";
import type { RequestOptions } from "../request-options.js";

export class ProvisionClient {
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
   * Provision a new project in your organization.
   * Pre-creates a user account, project, and API key.
   * Returns a claim URL and API key. Requires admin/owner role.
   */
  provisionProject = async (
    input?: ProvisionProjectInput,
    options?: RequestOptions,
  ): Promise<ProvisionProjectResponse> => {
    const url = `${this.baseUrl}/v1/team/provisions`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.buildHeaders(options),
        body: JSON.stringify(input ?? {}),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new OneCLIError(
            "Project provisioning requires OneCLI Cloud. See https://onecli.sh for details.",
          );
        }
        throw new OneCLIRequestError(
          `OneCLI returned ${res.status} ${res.statusText}`,
          { url, statusCode: res.status },
        );
      }

      return (await res.json()) as ProvisionProjectResponse;
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
}
