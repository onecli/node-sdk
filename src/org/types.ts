/**
 * Input for connecting an app at the organization level with direct
 * credentials (API-key / imported-credential apps). Field names must match
 * the app's own connection method field definitions.
 */
export interface ConnectOrgAppInput {
  fields: Record<string, string>;
  /** Existing connection id to reconnect instead of creating a new one. */
  connectionId?: string;
  /** Optional display label; defaults to a metadata-derived one. */
  label?: string;
  /** Connection method for apps with alternates (e.g. "api_key" on an OAuth-primary app). */
  method?: string;
}

export interface GetOrgAuthorizeUrlOptions {
  /** Existing connection id to re-authenticate. */
  connectionId?: string;
}

/** An organization-scoped app connection, shared by every project in the org. */
export interface OrgConnection {
  id: string;
  provider: string;
  label: string | null;
  status: string;
  scopes: string[];
  scope: string;
  metadata: Record<string, unknown> | null;
  connectedAt: string;
}

export type OrgRuleAction =
  | "block"
  | "rate_limit"
  | "manual_approval"
  | "allow";

export type OrgRuleMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type OrgRuleRateLimitWindow = "minute" | "hour" | "day";

/** A behavioral condition on a rule (e.g. body contains a value). */
export interface OrgRuleCondition {
  target: "body";
  operator: "contains";
  value: string;
  /** Optionally narrows the match to a specific field within the target. */
  key?: string;
}

/** An organization-scoped policy rule, applied to every agent in the org. */
export interface OrgRule {
  id: string;
  name: string;
  hostPattern: string;
  pathPattern: string | null;
  method: OrgRuleMethod | null;
  action: OrgRuleAction;
  enabled: boolean;
  rateLimit: number | null;
  rateLimitWindow: OrgRuleRateLimitWindow | null;
  scope?: string;
  conditions?: OrgRuleCondition[];
  metadata?: unknown;
  createdAt: string;
}

export interface CreateOrgRuleInput {
  name: string;
  hostPattern: string;
  action: OrgRuleAction;
  enabled: boolean;
  pathPattern?: string;
  method?: OrgRuleMethod;
  /** Required when `action` is "rate_limit". */
  rateLimit?: number;
  /** Required when `action` is "rate_limit". */
  rateLimitWindow?: OrgRuleRateLimitWindow;
  conditions?: OrgRuleCondition[];
}

/**
 * Partial update for an organization rule. Nullable fields accept an explicit
 * `null` to clear the stored value (omitting a field leaves it unchanged).
 */
export interface UpdateOrgRuleInput {
  name?: string;
  hostPattern?: string;
  action?: OrgRuleAction;
  enabled?: boolean;
  pathPattern?: string | null;
  method?: OrgRuleMethod | null;
  rateLimit?: number | null;
  rateLimitWindow?: OrgRuleRateLimitWindow | null;
  conditions?: OrgRuleCondition[] | null;
}
