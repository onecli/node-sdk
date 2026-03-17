export interface CreateAgentInput {
  /** Display name for the agent. */
  name: string;

  /** Unique identifier (lowercase letters, numbers, hyphens, starts with a letter). */
  identifier: string;
}

export interface CreateAgentResponse {
  id: string;
  name: string;
  identifier: string;
  createdAt: string;
}
