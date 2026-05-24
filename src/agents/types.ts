export interface CreateAgentInput {
  /** Display name for the agent. */
  name: string;

  /** Unique identifier (lowercase letters, numbers, hyphens, starts with a letter). */
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

export interface EnsureAgentResponse {
  name: string;
  identifier: string;
  /** Whether the agent was newly created. `false` if it already existed. */
  created: boolean;
}
