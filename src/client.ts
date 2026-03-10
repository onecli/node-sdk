import { OneCLIError } from "./errors.js";
import { ProxyClient } from "./proxy/index.js";
import type { OneCLIOptions } from "./types.js";

const DEFAULT_TIMEOUT = 5000;

export class OneCLI {
  private proxyUrl: string | undefined;
  private timeout: number;

  private proxyClient: ProxyClient | undefined;

  constructor(options?: OneCLIOptions) {
    this.proxyUrl = options?.proxyUrl ?? process.env.ONECLI_PROXY_URL;
    this.timeout = options?.timeout ?? DEFAULT_TIMEOUT;

    if (this.proxyUrl) {
      this.proxyClient = new ProxyClient(this.proxyUrl, this.timeout);
    }
  }

  /**
   * Access the proxy client for container configuration.
   * Throws if no proxy URL was configured.
   */
  proxy = (): ProxyClient => {
    if (!this.proxyClient) {
      throw new OneCLIError(
        'No proxy URL configured. Pass { proxyUrl: "..." } to OneCLI() or set the ONECLI_PROXY_URL environment variable.',
      );
    }
    return this.proxyClient;
  };
}
