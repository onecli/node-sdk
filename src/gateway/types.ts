// Typed bodies for the errors the OneCLI gateway returns on PROXIED agent
// traffic (not the management REST API — those errors ride the
// `{ error: { message, type } }` envelope instead).
//
// Agent requests reach providers through the gateway proxy transparently, so
// these bodies arrive on ordinary fetch/HTTP responses inside agent code. All
// of them carry `x-should-retry: false`: an unchanged retry will not succeed —
// the fix is the named remediation (add the connection header, attach the
// credential, open the URL).

/** One connectable account, as listed in disambiguation responses and the
 * `x-onecli-connections` response header. */
export interface GatewayConnectionChoice {
  id: string;
  label: string | null;
  provider: string;
  display_name: string | null;
}

/** Request header naming which account a proxied request should use. */
export const CONNECTION_ID_HEADER = "x-onecli-connection-id";

/** Response header advertising the available accounts (a JSON array of
 * {@link GatewayConnectionChoice}) on successfully forwarded responses. */
export const CONNECTIONS_HEADER = "x-onecli-connections";

/**
 * 409 — two or more accounts of the SAME app could serve the request. Retry
 * the identical request with {@link CONNECTION_ID_HEADER} set to one of the
 * listed `connections[].id`.
 */
export interface MultipleConnectionsError {
  error: "multiple_connections";
  message: string;
  connections: GatewayConnectionChoice[];
  header: string;
  example: string;
}

/** 409 — accounts of DIFFERENT apps both match the request. Same retry
 * protocol as {@link MultipleConnectionsError}. */
export interface MultipleProvidersError {
  error: "multiple_providers";
  message: string;
  connections: GatewayConnectionChoice[];
  header: string;
  example: string;
}

/** 404 — the id sent in {@link CONNECTION_ID_HEADER} names no available
 * connection (stale or removed). Re-pick from `connections`. */
export interface ConnectionNotFoundError {
  error: "connection_not_found";
  message: string;
  connections: GatewayConnectionChoice[];
  header: string;
}

/**
 * 401/403 (the upstream status is preserved) — a credential for this host
 * exists in the project, but the agent has no grant for it. `manage_url`
 * opens the account's Agent access dialog.
 */
export interface AccessRestrictedError {
  error: "access_restricted";
  message: string;
  provider: string;
  manage_url: string;
}

/** 403 — a policy rule blocked the request. */
export interface BlockedByPolicyError {
  error: "blocked_by_policy";
  message: string;
  rule_name: string;
  method: string;
  path: string;
  dashboard_url: string;
}

/** 403 — nothing allowed the request under a deny-by-default posture. */
export interface BlockedByDefaultPolicyError {
  error: "blocked_by_default_policy";
  message: string;
  method: string;
  host: string;
  path: string;
  dashboard_url: string;
}

/** 401/403 (upstream status preserved) — no credential exists for the host at
 * all. `secret_url` is a pre-built create link. */
export interface CredentialNotFoundError {
  error: "credential_not_found";
  message: string;
  hostname: string;
  path: string;
  secret_url: string;
}

export type GatewayError =
  | MultipleConnectionsError
  | MultipleProvidersError
  | ConnectionNotFoundError
  | AccessRestrictedError
  | BlockedByPolicyError
  | BlockedByDefaultPolicyError
  | CredentialNotFoundError;

const GATEWAY_ERROR_CODES = new Set<string>([
  "multiple_connections",
  "multiple_providers",
  "connection_not_found",
  "access_restricted",
  "blocked_by_policy",
  "blocked_by_default_policy",
  "credential_not_found",
]);

/**
 * Narrow an already-parsed response body to a typed gateway error, or `null`
 * when the body is not one (an ordinary provider error, a management-API
 * envelope, a non-object).
 *
 * ```ts
 * const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me");
 * if (!res.ok) {
 *   const err = parseGatewayError(await res.json().catch(() => null));
 *   if (err?.error === "multiple_connections") {
 *     // retry with { [CONNECTION_ID_HEADER]: err.connections[0].id }
 *   }
 * }
 * ```
 */
export const parseGatewayError = (body: unknown): GatewayError | null => {
  if (typeof body !== "object" || body === null) return null;
  const candidate = body as { error?: unknown };
  if (
    typeof candidate.error !== "string" ||
    !GATEWAY_ERROR_CODES.has(candidate.error)
  ) {
    return null;
  }
  return body as GatewayError;
};
