import { OneCLIError, OneCLIRequestError, toOneCLIError } from "../errors.js";
import { writeCaCertificate, buildCombinedCaBundle } from "./ca.js";
import type { ApplyContainerConfigOptions, ContainerConfig } from "./types.js";

export class ContainerClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(baseUrl: string, apiKey: string, timeout: number) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.timeout = timeout;
  }

  /**
   * Fetch the raw container configuration from OneCLI.
   */
  getContainerConfig = async (agent?: string): Promise<ContainerConfig> => {
    const url = agent
      ? `${this.baseUrl}/api/container-config?agent=${encodeURIComponent(agent)}`
      : `${this.baseUrl}/api/container-config`;

    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!res.ok) {
        throw new OneCLIRequestError(
          `OneCLI returned ${res.status} ${res.statusText}`,
          { url, statusCode: res.status },
        );
      }

      return (await res.json()) as ContainerConfig;
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
   * Fetch the container config from OneCLI and push the corresponding
   * `-e` and `-v` flags onto the Docker `run` argument array.
   *
   * Returns `true` if OneCLI was reachable and config was applied,
   * `false` otherwise (graceful degradation).
   */
  applyContainerConfig = async (
    args: string[],
    options?: ApplyContainerConfigOptions,
  ): Promise<boolean> => {
    const { combineCaBundle = true, addHostMapping = true, agent } =
      options ?? {};

    let config: ContainerConfig;
    try {
      config = await this.getContainerConfig(agent);
    } catch {
      return false;
    }

    // Inject server-controlled environment variables
    for (const [key, value] of Object.entries(config.env)) {
      args.push("-e", `${key}=${value}`);
    }

    // Write CA certificate to host temp file and mount into container
    const hostCaPath = writeCaCertificate(config.caCertificate);
    args.push(
      "-v",
      `${hostCaPath}:${config.caCertificateContainerPath}:ro`,
    );

    // Build combined CA bundle for system-wide trust (curl, Python, Go, etc.)
    if (combineCaBundle) {
      const combinedPath = buildCombinedCaBundle(config.caCertificate);
      if (combinedPath) {
        args.push("-e", "SSL_CERT_FILE=/tmp/onecli-combined-ca.pem");
        // DENO_CERT: Deno does not respect SSL_CERT_FILE, it has its own env var
        args.push("-e", "DENO_CERT=/tmp/onecli-combined-ca.pem");
        args.push("-v", `${combinedPath}:/tmp/onecli-combined-ca.pem:ro`);
      }
    }

    // On Linux, host.docker.internal needs explicit mapping.
    if (addHostMapping && process.platform === "linux") {
      args.push("--add-host", "host.docker.internal:host-gateway");
    }

    return true;
  };
}
