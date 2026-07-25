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

/**
 * An organization-scoped policy rule, applied to every agent in the org.
 *
 * The endpoint fields (`hostPattern`/`pathPattern`/`method`) are present on
 * custom (user-authored) rules only. App-permission rules — rows whose
 * `metadata.source` is `"app_permission"` — omit them; those rules are
 * identified by `metadata.provider` + `metadata.toolId`. On cloud
 * deployments app permissions are managed as policy-engine rules (see
 * `createPolicyRule`); the legacy permissions endpoint is retired there.
 */
export interface OrgRule {
  id: string;
  name: string;
  hostPattern?: string;
  pathPattern?: string | null;
  method?: OrgRuleMethod | null;
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

/** A policy-engine rule action. */
export type PolicyRuleAction = "allow" | "block";

/** A policy-engine rule's lifecycle status. */
export type PolicyRuleStatus = "draft" | "published";

/**
 * A principal a policy rule applies to, as the API returns it. Org rules
 * carry `agentGroup`, `user`, or `group` identities (`agent` exists at
 * project scope only); an empty identity list means "everyone".
 */
export interface PolicyRuleIdentity {
  type: "agent" | "agentGroup" | "user" | "group";
  id: string;
}

/**
 * An identity on an org policy rule INPUT. The org API rejects `agent`
 * identities (those exist at project scope only), so the input type
 * excludes that kind entirely.
 */
export interface OrgPolicyRuleIdentityInput {
  type: Exclude<PolicyRuleIdentity["type"], "agent">;
  id: string;
}

/**
 * One destination a policy rule matches — a discriminated union on `kind`,
 * as the API RETURNS it: array fields are always present (`[]` when unset)
 * and unset scalars are explicit `null`s. Rule inputs use
 * {@link PolicyRuleTargetInput} — the same union with optional fields
 * instead (the API rejects `null`s on write).
 */
export type PolicyRuleTarget =
  | {
      kind: "app";
      provider: string;
      tools: string[];
      connectionScope: "organization" | "project" | null;
    }
  | { kind: "connection"; connectionId: string; tools: string[] }
  | {
      kind: "secret";
      secretId: string | null;
      secretScope: "organization" | "project" | null;
    }
  | {
      kind: "network";
      hostPattern: string;
      pathPattern: string | null;
      // The response reflects storage: rows backfilled from the legacy model
      // may carry method strings outside the 5-verb authoring enum.
      method: string | null;
    };

/**
 * A target on a policy rule INPUT — omit optional fields when unused (the
 * API rejects explicit `null`s on write). An `app` target names a provider
 * (optionally narrowed by `tools`); a `connection` target names one
 * connection by `connectionId`; a `secret` target names a specific
 * `secretId` XOR a `secretScope` level; a `network` target matches raw
 * host/path/method patterns.
 */
export type PolicyRuleTargetInput =
  | {
      kind: "app";
      provider: string;
      tools?: string[];
      connectionScope?: "organization" | "project";
    }
  | { kind: "connection"; connectionId: string; tools?: string[] }
  | {
      kind: "secret";
      secretId?: string;
      secretScope?: "organization" | "project";
    }
  | {
      kind: "network";
      hostPattern: string;
      pathPattern?: string;
      method?: OrgRuleMethod;
    };

/**
 * A policy rule's `conditions` on input: EITHER behavioral (body-contains)
 * conditions OR a connection target's resource scoping (`repositories` /
 * `folders`) — never both on one rule.
 */
export type PolicyRuleConditionsInput =
  | OrgRuleCondition[]
  | { repositories: string[] }
  | { folders: string[] };

/**
 * An organization policy-engine rule (the staged draft→publish model).
 * Writes land in the DRAFT and enforce only after a publish; published row
 * `id`s regenerate on every publish — `logicalId` is the identity that is
 * stable across statuses and generations.
 */
export interface OrgPolicyRule {
  id: string;
  scope: string;
  status: PolicyRuleStatus;
  generation: number;
  priority: number;
  enabled: boolean;
  isDefault: boolean;
  logicalId: string;
  source: string;
  name: string;
  description: string | null;
  action: PolicyRuleAction;
  rateLimit: number | null;
  rateLimitWindow: OrgRuleRateLimitWindow | null;
  requireApproval: boolean;
  conditions: unknown;
  identities: PolicyRuleIdentity[];
  targets: PolicyRuleTarget[];
  createdAt: string;
}

/**
 * Input for creating a policy-engine rule. `targets` must name at least one
 * destination; `rateLimit`/`rateLimitWindow` are paired and — like
 * `requireApproval` — valid only on `action: "allow"`.
 */
export interface CreateOrgPolicyRuleInput {
  name: string;
  description?: string;
  enabled?: boolean;
  action: PolicyRuleAction;
  rateLimit?: number;
  rateLimitWindow?: OrgRuleRateLimitWindow;
  requireApproval?: boolean;
  conditions?: PolicyRuleConditionsInput;
  identities?: OrgPolicyRuleIdentityInput[];
  targets: PolicyRuleTargetInput[];
}

/**
 * Input for updating a DRAFT policy-engine rule — every field optional;
 * nullable fields accept an explicit `null` to clear. The server rejects
 * an empty body with 422 ("At least one field must be provided").
 */
export interface UpdateOrgPolicyRuleInput {
  name?: string;
  description?: string | null;
  enabled?: boolean;
  action?: PolicyRuleAction;
  rateLimit?: number | null;
  rateLimitWindow?: OrgRuleRateLimitWindow | null;
  requireApproval?: boolean;
  conditions?: PolicyRuleConditionsInput | null;
  identities?: OrgPolicyRuleIdentityInput[];
  targets?: PolicyRuleTargetInput[];
}

/** Per-write publish control (the staged model). */
export interface PolicyWriteOptions {
  /**
   * Skip the automatic publish after the write, leaving it staged in the
   * draft. Publish later with `publishPolicy()`. Note a publish snapshots
   * the WHOLE org draft — including changes staged by other users — so
   * `skipPublish` + an explicit reviewed `publishPolicy()` is the safe path
   * when several people edit policy.
   */
  skipPublish?: boolean;
}

/**
 * The result of a policy write plus its publish outcome — discriminated on
 * `published`, so narrowing on it types `generation` accordingly. `result`
 * is the written entity (the rule, or the reordered rule list).
 */
export type PolicyWriteResult<T> =
  | { result: T; published: true; generation: number }
  | { result: T; published: false; generation: null };

/** The result of a policy publish. */
export interface PolicyPublishResult {
  generation: number;
  ruleCount: number;
}

/** The most recent publish (null when the org was never published). */
export interface PolicyLastPublish {
  generation: number;
  ruleCount: number;
  appliedAt: string;
  appliedBy: { name: string | null; email: string } | null;
}

// ── Effective app permissions (the read-only policy reflection) ─────────────
//
// Replaces the retired `/v1/org/rules/permissions/:provider` surface. This is a
// REFLECTION, not an editor: it reports what the org's published policy actually
// allows per tool. Author changes with the `*PolicyRule` methods.

/** What the published policy does to one tool.
 *
 * `mixed` means the tool's variants — or a group's tools — disagree.
 * `unmanaged` means no rule applies and the traffic passes through under the
 * enforce-deny carve (no credential attached, or an LLM host).
 *
 * A rate limit is NOT a verdict: it rides `rateLimit` / `rateLimitWindow` on an
 * `allow`. */
export type EffectiveToolVerdict =
  | "allow"
  | "approval"
  | "block"
  | "mixed"
  | "unmanaged";

/** Which rule decided, when one did. An org rule's NAME is visible only to org
 * admins; other viewers get `redacted: true` with the name withheld. */
export type EffectiveProvenance =
  | { scope: "organization"; redacted: true }
  | {
      scope: "organization" | "project";
      rule: { logicalId: string; name: string };
    };

export interface EffectiveTool {
  toolId: string;
  verdict: EffectiveToolVerdict;
  rateLimit: number | null;
  rateLimitWindow: string | null;
  /** Null when the tool's variants disagree, or when it is allowed purely by an
   * allow-posture default rather than a specific rule. */
  decidedBy: EffectiveProvenance | null;
}

export interface EffectiveToolGroup {
  category: "read" | "write";
  /** The rollup: the tools' common verdict, else `mixed`. */
  verdict: EffectiveToolVerdict;
  tools: EffectiveTool[];
}

/** The per-tool reflection for one app. Structurally identical at project and
 * organization scope — `basis.scope` reports which produced it. */
export interface EffectiveAppPermissions {
  provider: string;
  basis: {
    /** Null = the agent-less baseline; only any-identity rules are applied. */
    agentId: string | null;
    credentialAttached: boolean;
    scope: "organization" | "project";
  };
  /** Count of identity-scoped rules the baseline view cannot show, because they
   * match only specific agents or groups. */
  variesByIdentity: number;
  groups: EffectiveToolGroup[];
}
