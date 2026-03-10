import { OneCLIError, OneCLIRequestError, toOneCLIError } from "../errors.js";
import { buildCombinedCaBundle } from "./container.js";
import type {
  ApplyContainerConfigOptions,
  ContainerConfig,
  ContainerMount,
} from "./types.js";

export class ProxyClient {
  private proxyUrl: string;
  private timeout: number;

  constructor(proxyUrl: string, timeout: number) {
    this.proxyUrl = proxyUrl.replace(/\/+$/, "");
    this.timeout = timeout;
  }

  /**
   * Fetch the raw container configuration from the proxy.
   * Returns the env vars and mounts the proxy wants injected into the container.
   */
  getContainerConfig = async (): Promise<ContainerConfig> => {
    const url = `${this.proxyUrl}/container-config`;

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!res.ok) {
        throw new OneCLIRequestError(
          `Proxy returned ${res.status} ${res.statusText}`,
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
   * Fetch the proxy's container config and push the corresponding
   * `-e` and `-v` flags onto the Docker `run` argument array.
   *
   * Returns `true` if the proxy was reachable and config was applied.
   *
   * @param args  The Docker `run` argument array to mutate.
   * @param options  Optional configuration for the apply behavior.
   */
  applyContainerConfig = async (
    args: string[],
    options?: ApplyContainerConfigOptions,
  ): Promise<boolean> => {
    const { combineCaBundle = true, addHostMapping = true } = options ?? {};

    let config: ContainerConfig;
    try {
      config = await this.getContainerConfig();
    } catch {
      return false;
    }

    // Inject environment variables
    for (const [key, value] of Object.entries(config.env)) {
      args.push("-e", `${key}=${value}`);
    }

    // Inject volume mounts
    for (const mount of config.mounts) {
      if (mount.readonly) {
        args.push("-v", `${mount.hostPath}:${mount.containerPath}:ro`);
      } else {
        args.push("-v", `${mount.hostPath}:${mount.containerPath}`);
      }
    }

    // Build combined CA bundle for system-wide trust (curl, Python, Go, etc.)
    // NODE_EXTRA_CA_CERTS handles Node.js; SSL_CERT_FILE handles everything else.
    if (combineCaBundle) {
      const nodeExtraCa = config.env["NODE_EXTRA_CA_CERTS"];
      if (nodeExtraCa) {
        const caMount = config.mounts.find(
          (m) => m.containerPath === nodeExtraCa,
        );
        if (caMount) {
          const combinedPath = buildCombinedCaBundle(caMount.hostPath);
          if (combinedPath) {
            args.push("-e", "SSL_CERT_FILE=/tmp/combined-ca.crt");
            args.push("-v", `${combinedPath}:/tmp/combined-ca.crt:ro`);
          }
        }
      }
    }

    // On Linux, host.docker.internal needs explicit mapping.
    // macOS Docker Desktop provides it automatically.
    if (addHostMapping && process.platform === "linux") {
      args.push("--add-host", "host.docker.internal:host-gateway");
    }

    return true;
  };
}
