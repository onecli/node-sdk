export interface OneCLIOptions {
  /**
   * User API key from the OneCLI dashboard (starts with `oc_`).
   * Falls back to `ONECLI_API_KEY` env var if not provided.
   */
  apiKey?: string;

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

  /**
   * Gateway URL for manual approval polling.
   * Falls back to `ONECLI_GATEWAY_URL` env var, then auto-resolved
   * from the web app via `GET /api/gateway-url`.
   */
  gatewayUrl?: string;
}
