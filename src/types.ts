export interface OneCLIOptions {
  /**
   * User API key from the OneCLI dashboard (starts with `oc_`).
   */
  apiKey: string;

  /**
   * Base URL of the OneCLI instance.
   * Falls back to `ONECLI_URL` env var, then `https://app.onecli.sh`.
   */
  url?: string;

  /**
   * Request timeout in milliseconds.
   * @default 5000
   */
  timeout?: number;
}
