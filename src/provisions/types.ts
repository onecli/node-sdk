export interface ProvisionUserInput {
  /** Role for the provisioned user. Defaults to "member". */
  role?: "admin" | "member";

  /** Whether the provisioned user skips the onboarding flow. Defaults to true. */
  skipOnboarding?: boolean;
}

export interface ProvisionUserResponse {
  /** Provision record ID. */
  id: string;

  /** Placeholder user ID (becomes the real user ID after claiming). */
  userId: string;

  /** Pre-created project ID. */
  projectId: string;

  /** API key for the provisioned project (usable immediately). */
  apiKey: string;

  /** URL the provisioned user visits to claim their account. Expires in 7 days. */
  claimUrl: string;

  /** ISO 8601 expiration timestamp. */
  expiresAt: string;
}
