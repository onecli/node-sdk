export interface OneCLIOptions {
  /**
   * API key from the OneCLI dashboard.
   * Supports both project keys (`oc_...`) and org keys (`oc_org_...`).
   * Falls back to `ONECLI_API_KEY` env var if not provided.
   */
  apiKey?: string;

  /**
   * Base URL of the OneCLI instance.
   * Falls back to `ONECLI_URL` env var, then `https://api.onecli.sh`.
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
   * from the web app via `GET /v1/gateway-url`.
   */
  gatewayUrl?: string;

  /**
   * Default project ID for org-level API keys (`oc_org_...`).
   * Falls back to `ONECLI_PROJECT_ID` env var.
   * Can be overridden per-operation via `RequestOptions`.
   */
  projectId?: string;
}
