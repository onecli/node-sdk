export { OneCLI } from "./client.js";
export { ContainerClient } from "./container/index.js";
export { AgentsClient } from "./agents/index.js";
export { ApprovalClient } from "./approvals/index.js";
export { OrgApprovalClient } from "./approvals/org.js";
export { ProvisionClient } from "./provisions/index.js";
export { OrgClient } from "./org/index.js";
export { OneCLIError, OneCLIRequestError } from "./errors.js";

export type { OneCLIOptions } from "./types.js";
export type { RequestOptions } from "./request-options.js";
export type {
  ContainerConfig,
  CredentialStub,
  GetContainerConfigOptions,
  ApplyContainerConfigOptions,
} from "./container/types.js";
export type {
  Agent,
  CreateAgentInput,
  CreateAgentResponse,
  EnsureAgentResponse,
  // Read-only policy reflections — the replacements for the retired
  // per-agent equipment reads.
  AgentAccessStatus,
  AgentCredentialStatus,
  AppPermissionDefinition,
  ConnectionAgent,
  ConnectionAgentAccess,
  CredentialAccessStatus,
  CredentialProvenance,
  EffectiveCredential,
  EffectiveCredentials,
  AgentGrants,
  AgentGrantConnection,
  AgentGrantSecret,
  AgentGrantsSummary,
  AgentWithGrantsSummary,
  ConnectionGrantInput,
  ConnectionGrants,
  GrantsSummaryEntry,
} from "./agents/types.js";
export {
  CONNECTION_ID_HEADER,
  CONNECTIONS_HEADER,
  parseGatewayError,
} from "./gateway/types.js";
export type {
  AccessRestrictedError,
  BlockedByDefaultPolicyError,
  BlockedByPolicyError,
  ConnectionNotFoundError,
  CredentialNotFoundError,
  GatewayConnectionChoice,
  GatewayError,
  MultipleConnectionsError,
  MultipleProvidersError,
} from "./gateway/types.js";
export type {
  ApprovalRequest,
  ApprovalSummary,
  ApprovalDetail,
  ManualApprovalCallback,
  ManualApprovalHandle,
  OrgApprovalRequest,
  OrgManualApprovalCallback,
  OrgManualApprovalOptions,
} from "./approvals/types.js";
export type {
  ProvisionProjectInput,
  ProvisionProjectResponse,
} from "./provisions/types.js";
export type {
  ConnectOrgAppInput,
  GetOrgAuthorizeUrlOptions,
  OrgConnection,
  OrgPolicyRule,
  OrgRuleCondition,
  OrgRuleMethod,
  OrgRuleRateLimitWindow,
  EffectiveAppPermissions,
  EffectiveTool,
  EffectiveToolGroup,
  EffectiveToolVerdict,
  EffectiveProvenance,
  PolicyRuleAction,
  PolicyRuleStatus,
  PolicyRuleIdentity,
  OrgPolicyRuleIdentityInput,
  PolicyRuleTarget,
  PolicyRuleTargetInput,
  PolicyRuleConditionsInput,
  CreateOrgPolicyRuleInput,
  UpdateOrgPolicyRuleInput,
  PolicyWriteOptions,
  PolicyWriteResult,
  PolicyPublishResult,
  PolicyLastPublish,
} from "./org/types.js";
