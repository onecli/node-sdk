import { OneCLIError, OneCLIRequestError, toOneCLIError } from "../errors.js";
import { writeCaCertificate, buildCombinedCaBundle } from "./ca.js";
import { writeCredentialStub } from "./credentials.js";
import type {
  ApplyContainerConfigOptions,
  ContainerConfig,
  GetContainerConfigOptions,
} from "./types.js";
import type { RequestOptions } from "../request-options.js";

export class ContainerClient {
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
    const headers: Record<string, string> = {};
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
   * Fetch the gateway skill markdown from OneCLI.
   */
  getGatewaySkill = async (options?: RequestOptions): Promise<string> => {
    const url = `${this.baseUrl}/v1/skill/gateway`;
    try {
      const res = await fetch(url, {
        headers: this.buildHeaders(options),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!res.ok) {
        throw new OneCLIRequestError(
          `OneCLI returned ${res.status} ${res.statusText}`,
          { url, statusCode: res.status },
        );
      }

      return await res.text();
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
   * Fetch the raw container configuration from OneCLI.
   */
  getContainerConfig = async (
    options?: GetContainerConfigOptions,
  ): Promise<ContainerConfig> => {
    const { agent, ...requestOptions } = options ?? {};
    const url = agent
      ? `${this.baseUrl}/v1/container-config?agent=${encodeURIComponent(agent)}`
      : `${this.baseUrl}/v1/container-config`;

    try {
      const res = await fetch(url, {
        headers: this.buildHeaders(requestOptions),
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
   * Returns `true` once config is applied. Returns `false` only when OneCLI
   * is unreachable or unhealthy (network error or 5xx) -- a transient outage
   * shouldn't block container launches.
   *
   * Throws `OneCLIRequestError` on a 4xx response (e.g. the agent identifier
   * isn't registered, or the API key is invalid). Those are caller
   * misconfigurations: degrading silently would launch the container without
   * credentials and leave it hanging. Handle the error -- don't swallow it.
   */
  applyContainerConfig = async (
    args: string[],
    options?: ApplyContainerConfigOptions,
  ): Promise<boolean> => {
    const {
      combineCaBundle = true,
      addHostMapping = true,
      agent,
      projectId,
    } = options ?? {};

    let config: ContainerConfig;
    try {
      config = await this.getContainerConfig({ agent, projectId });
    } catch (error) {
      // Fail loud on caller/config errors (4xx): a missing agent, invalid API
      // key, or forbidden project means the container would otherwise launch
      // WITHOUT credentials and silently hang. Surface it so it's traceable.
      if (
        error instanceof OneCLIRequestError &&
        error.statusCode >= 400 &&
        error.statusCode < 500
      ) {
        throw error;
      }
      // Graceful degradation only when OneCLI is unreachable or unhealthy
      // (network error or 5xx) -- don't block launches on a transient outage.
      return false;
    }

    // Inject server-controlled environment variables
    for (const [key, value] of Object.entries(config.env)) {
      args.push("-e", `${key}=${value}`);
    }

    // Write CA certificate to host temp file and mount into container.
    // `,z` is a shared SELinux relabel so the container can read the cert
    // on enforcing systems (Fedora + podman). No-op on non-SELinux hosts.
    const hostCaPath = writeCaCertificate(config.caCertificate);
    args.push(
      "-v",
      `${hostCaPath}:${config.caCertificateContainerPath}:ro,z`,
    );

    // Build combined CA bundle for system-wide trust (curl, Python, Go, etc.)
    if (combineCaBundle) {
      const combinedPath = buildCombinedCaBundle(config.caCertificate);
      if (combinedPath) {
        args.push("-e", "SSL_CERT_FILE=/tmp/onecli-combined-ca.pem");
        // DENO_CERT: Deno does not respect SSL_CERT_FILE, it has its own env var
        args.push("-e", "DENO_CERT=/tmp/onecli-combined-ca.pem");
        args.push("-v", `${combinedPath}:/tmp/onecli-combined-ca.pem:ro,z`);
      }
    }

    // Write credential stubs and mount into container
    if (config.credentialStubs?.length) {
      for (const stub of config.credentialStubs) {
        const hostPath = writeCredentialStub(
          stub.containerPath,
          stub.content,
        );
        args.push("-v", `${hostPath}:${stub.containerPath}:ro`);
      }
    }

    // On Linux, host.docker.internal needs explicit mapping.
    if (addHostMapping && process.platform === "linux") {
      args.push("--add-host", "host.docker.internal:host-gateway");
    }

    return true;
  };
}
