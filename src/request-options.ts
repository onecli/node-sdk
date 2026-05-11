/**
 * Per-operation options that can override constructor defaults.
 * Used with organization-level API keys (`oc_org_...`) to specify
 * which project to target.
 */
export interface RequestOptions {
  /**
   * Project ID to target. Required for org-level API keys (`oc_org_...`).
   * Overrides the default `projectId` from the constructor.
   */
  projectId?: string;
}
