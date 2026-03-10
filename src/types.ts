export interface OneCLIOptions {
  /**
   * Base URL of the OneCLI proxy.
   * Example: "http://localhost:18080"
   *
   * Can also be set via the `ONECLI_PROXY_URL` environment variable.
   */
  proxyUrl?: string;

  /**
   * Request timeout in milliseconds.
   * @default 5000
   */
  timeout?: number;
}
