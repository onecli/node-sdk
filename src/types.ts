export interface OneCLIOptions {
  /**
   * Base URL of the OneCLI instance.
   * Example: "http://localhost:18080"
   *
   * Can also be set via the `ONECLI_URL` environment variable.
   */
  onecliUrl?: string;

  /**
   * Request timeout in milliseconds.
   * @default 5000
   */
  timeout?: number;
}
