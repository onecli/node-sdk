import { ContainerClient } from "./container/index.js";
import { AgentsClient } from "./agents/index.js";
import { ApprovalClient } from "./approvals/index.js";
import { ProvisionClient } from "./provisions/index.js";
import type { OneCLIOptions } from "./types.js";
import type { RequestOptions } from "./request-options.js";
import type {
  ApplyContainerConfigOptions,
  ContainerConfig,
  GetContainerConfigOptions,
} from "./container/types.js";
import type {
  CreateAgentInput,
  CreateAgentResponse,
  EnsureAgentResponse,
} from "./agents/types.js";
import type {
  ManualApprovalCallback,
  ManualApprovalHandle,
} from "./approvals/types.js";
import type {
  ProvisionProjectInput,
  ProvisionProjectResponse,
} from "./provisions/types.js";

const DEFAULT_URL = "https://api.onecli.sh";
const DEFAULT_TIMEOUT = 5000;

export class OneCLI {
  private containerClient: ContainerClient;
  private agentsClient: AgentsClient;
  private approvalClient: ApprovalClient;
  private provisionClient: ProvisionClient;

  constructor(options: OneCLIOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ONECLI_API_KEY ?? "";
    const url = options.url ?? process.env.ONECLI_URL ?? DEFAULT_URL;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const gatewayUrl =
      options.gatewayUrl ?? process.env.ONECLI_GATEWAY_URL ?? null;
    const projectId =
      options.projectId ?? process.env.ONECLI_PROJECT_ID ?? null;

    this.containerClient = new ContainerClient(
      url,
      apiKey,
      timeout,
      projectId,
    );
    this.agentsClient = new AgentsClient(url, apiKey, timeout, projectId);
    this.approvalClient = new ApprovalClient(
      url,
      apiKey,
      gatewayUrl,
      projectId,
    );
    this.provisionClient = new ProvisionClient(
      url,
      apiKey,
      timeout,
      projectId,
    );
  }

  /**
   * Fetch the gateway skill markdown from OneCLI.
   */
  getGatewaySkill = (options?: RequestOptions): Promise<string> => {
    return this.containerClient.getGatewaySkill(options);
  };

  /**
   * Fetch the raw container configuration from OneCLI.
   */
  getContainerConfig = (
    options?: GetContainerConfigOptions,
  ): Promise<ContainerConfig> => {
    return this.containerClient.getContainerConfig(options);
  };

  /**
   * Fetch config and apply `-e` / `-v` flags to a Docker `run` argument array.
   * Returns `true` on success, `false` on failure (graceful degradation).
   */
  applyContainerConfig = (
    args: string[],
    options?: ApplyContainerConfigOptions,
  ): Promise<boolean> => {
    return this.containerClient.applyContainerConfig(args, options);
  };

  /**
   * Create a new agent.
   */
  createAgent = (
    input: CreateAgentInput,
    options?: RequestOptions,
  ): Promise<CreateAgentResponse> => {
    return this.agentsClient.createAgent(input, options);
  };

  /**
   * Ensure an agent exists. Creates it if missing, returns normally if it already exists.
   */
  ensureAgent = (
    input: CreateAgentInput,
    options?: RequestOptions,
  ): Promise<EnsureAgentResponse> => {
    return this.agentsClient.ensureAgent(input, options);
  };

  /**
   * Provision a new project in your organization.
   * Pre-creates a user account, project, and API key.
   * Returns a claim URL and API key. Requires admin/owner role.
   */
  provisionProject = (
    input?: ProvisionProjectInput,
    options?: RequestOptions,
  ): Promise<ProvisionProjectResponse> => {
    return this.provisionClient.provisionProject(input, options);
  };

  /**
   * Register a callback for manual approval requests.
   * Starts background long-polling to the gateway. The callback is called
   * once per pending approval request, concurrently for multiple requests.
   * Returns a handle to stop polling when shutting down.
   */
  configureManualApproval = (
    callback: ManualApprovalCallback,
    options?: RequestOptions,
  ): ManualApprovalHandle => {
    this.approvalClient.start(callback, options).catch(() => {
      // Errors handled internally with backoff
    });
    return { stop: () => this.approvalClient.stop() };
  };
}
