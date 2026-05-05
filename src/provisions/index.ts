import {
  OneCLIError,
  OneCLIRequestError,
  toOneCLIError,
} from "../errors.js";
import type { ProvisionUserInput, ProvisionUserResponse } from "./types.js";

export class ProvisionClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(baseUrl: string, apiKey: string, timeout: number) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.timeout = timeout;
  }

  /**
   * Provision a new user in your organization.
   * Pre-creates a user account, project, and API key.
   * Returns a claim URL and API key. Requires admin/owner role.
   */
  provisionUser = async (
    input?: ProvisionUserInput,
  ): Promise<ProvisionUserResponse> => {
    const url = `${this.baseUrl}/api/team/provisions`;

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
        body: JSON.stringify(input ?? {}),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new OneCLIError(
            "User provisioning requires OneCLI Cloud. See https://onecli.sh for details.",
          );
        }
        throw new OneCLIRequestError(
          `OneCLI returned ${res.status} ${res.statusText}`,
          { url, statusCode: res.status },
        );
      }

      return (await res.json()) as ProvisionUserResponse;
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
