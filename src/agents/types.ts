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
