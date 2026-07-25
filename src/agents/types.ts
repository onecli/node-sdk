export interface CreateAgentInput {
  /** Display name for the agent. */
  name: string;

  /** Unique identifier: 1-50 chars, lowercase letters, numbers, and hyphens, starting with a letter or number. */
  identifier: string;

  /** Identifier of the parent agent. Child inherits parent's secretMode and credential assignments. */
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
