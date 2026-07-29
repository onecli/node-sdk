export interface CreateAgentInput {
  /** Display name for the agent. */
  name: string;

  /** Unique identifier: 1-50 chars, lowercase letters, numbers, and hyphens, starting with a letter or number. */
  identifier: string;

  /**
   * Identifier of the parent agent. Accepted for compatibility; inheritance
   * was removed — every new agent starts with no credential grants regardless
   * of parent. Attach credentials with the grants methods.
   */
  parentIdentifier?: string;
}

export interface CreateAgentResponse {
  id: string;
  name: string;
  identifier: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  identifier: string;
  /** Whether this is the project's default agent. */
  isDefault: boolean;
  createdAt: string;
}

export interface EnsureAgentResponse {
  name: string;
  identifier: string;
  /** Whether the agent was newly created. `false` if it already existed. */
  created: boolean;
}

// ── Read-only policy reflections (project scope) ────────────────────────────
//
// These replace the retired per-agent equipment reads
// (`/v1/agents/:id/{secrets,connections}`, `/v1/agents/granular-access`,
// `/v1/connections/:id/agents`). They report what the PUBLISHED policy actually
// allows — not a stored assignment list, which no longer exists.

/** What a credential can do under the rules, once attached. */
export type CredentialAccessStatus =
  | "usable"
  | "limited"
  | "blocked"
  | "unknown";

/** Why a credential reaches this agent. An org rule's name is visible only to
 * org admins; other viewers get `redacted: true`. */
export type CredentialProvenance =
  | { kind: "rule"; scope: "organization"; redacted: true }
  | {
      kind: "rule";
      scope: "organization" | "project";
      rule: { logicalId: string; name: string };
    };

export type EffectiveCredential =
  | {
      kind: "secret";
      id: string;
      name: string;
      host: string;
      status: CredentialAccessStatus;
      provenance: CredentialProvenance[];
    }
  | {
      kind: "connection";
      id: string;
      label: string | null;
      provider: string;
      status: CredentialAccessStatus;
      provenance: CredentialProvenance[];
    };

export interface EffectiveCredentials {
  agentId: string;
  /** `all` draws the whole fenced pool; `selective` gets only what rules grant. */
  mode: "all" | "selective";
  secrets: EffectiveCredential[];
  connections: EffectiveCredential[];
}

/** The headline for one agent against one connection. */
export type AgentAccessStatus =
  | "usable"
  | "limited"
  | "blocked"
  | "none"
  | "unknown";

/** How the credential attaches — the secondary detail under `access`. */
export type AgentCredentialStatus =
  | { status: "full" }
  | { status: "viaRule"; provenance: CredentialProvenance[] }
  | { status: "none" };

export interface ConnectionAgent {
  agentId: string;
  name: string;
  access: AgentAccessStatus;
  credential: AgentCredentialStatus;
  /** Null when the provider has no tool catalog to evaluate. */
  decisions: {
    allowedTools: number;
    totalTools: number;
    anyApproval: boolean;
    anyRateLimit: boolean;
  } | null;
}

export interface ConnectionAgentAccess {
  connectionId: string;
  provider: string;
  /** False = no permission catalog, so `decisions` is absent by honesty. */
  catalog: boolean;
  agents: ConnectionAgent[];
}

/** One provider's public tool catalog — ids and labels only; the endpoint
 * mapping never leaves the server. */
export interface AppPermissionDefinition {
  provider: string;
  groups: {
    category: "read" | "write";
    tools: { id: string; name: string; description?: string }[];
  }[];
}

export type {
  EffectiveAppPermissions,
  EffectiveProvenance,
  EffectiveTool,
  EffectiveToolGroup,
  EffectiveToolVerdict,
} from "../org/types.js";

// ── Grants (the attach model) ────────────────────────────────────────────────
// A grant attaches one credential (an app connection, secret, or LLM key) to
// one agent, and is the only project-scope policy writer — the server compiles
// grants into policy rules. Grants are attach INTENT; the effective view (org
// guardrails applied) is the read-only reflections (`getEffectiveCredentials`,
// `getConnectionAgentAccess`, `getEffectiveAppPermissions`).

/**
 * The desired connection grant. `full` attaches every catalog tool (tools
 * added to the catalog later are included automatically). `custom` sets a
 * per-tool tri-state: `allow` always runs, `ask` needs manual approval, and
 * everything else is blocked.
 *
 * Server-enforced laws (422): `allow` and `ask` must not share a tool, and a
 * custom grant needs at least one tool across the two lists — an all-blocked
 * grant is a detach (`removeConnectionGrant`). A non-empty `ask` requires the
 * approvals feature (403 otherwise).
 */
export type ConnectionGrantInput =
  | { access: "full" }
  | { access: "custom"; allow: string[]; ask: string[] };

export interface AgentGrantConnection {
  connectionId: string;
  provider: string;
  label: string | null;
  scope: "project" | "organization";
  access: "full" | "custom";
  allow: string[];
  ask: string[];
}

export interface AgentGrantSecret {
  secretId: string;
  name: string;
  /** `generic` is a plain secret; anything else is an LLM key. */
  type: string;
  scope: "project" | "organization";
}

/** An agent's full grant set — returned by reads and by every grant write. */
export interface AgentGrants {
  agentId: string;
  /**
   * `grants` on current servers. The `all` arm is wire compatibility with
   * older self-hosted releases and disappears in a future release — never
   * branch behavior on it.
   */
  mode: "all" | "grants";
  connections: AgentGrantConnection[];
  secrets: AgentGrantSecret[];
}

/** Which agents a connection is granted to (the reverse view). */
export interface ConnectionGrants {
  connectionId: string;
  agents: {
    agentId: string;
    access: "full" | "custom";
    allow: string[];
    ask: string[];
  }[];
}

export type GrantsSummaryEntry =
  | {
      kind: "app";
      provider: string;
      connectionId: string;
      label: string | null;
    }
  | { kind: "secret" | "llm"; id: string; name: string };

/** The attach-list summary (`listAgentsWithGrants()`). */
export interface AgentGrantsSummary {
  mode: "all" | "grants";
  entries: GrantsSummaryEntry[];
  total: number;
}

export interface AgentWithGrantsSummary extends Agent {
  grantsSummary: AgentGrantsSummary;
}
