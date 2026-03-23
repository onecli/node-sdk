import { ContainerClient } from "./container/index.js";
import { AgentsClient } from "./agents/index.js";
import type { OneCLIOptions } from "./types.js";
import type {
  ApplyContainerConfigOptions,
  ContainerConfig,
} from "./container/types.js";
import type {
  CreateAgentInput,
  CreateAgentResponse,
  EnsureAgentResponse,
} from "./agents/types.js";

const DEFAULT_URL = "https://app.onecli.sh";
const DEFAULT_TIMEOUT = 5000;

export class OneCLI {
  private containerClient: ContainerClient;
  private agentsClient: AgentsClient;

  constructor(options: OneCLIOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ONECLI_API_KEY ?? "";
    const url = options.url ?? process.env.ONECLI_URL ?? DEFAULT_URL;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;

    this.containerClient = new ContainerClient(url, apiKey, timeout);
    this.agentsClient = new AgentsClient(url, apiKey, timeout);
  }

  /**
   * Fetch the raw container configuration from OneCLI.
   */
  getContainerConfig = (agent?: string): Promise<ContainerConfig> => {
    return this.containerClient.getContainerConfig(agent);
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
  createAgent = (input: CreateAgentInput): Promise<CreateAgentResponse> => {
    return this.agentsClient.createAgent(input);
  };

  /**
   * Ensure an agent exists. Creates it if missing, returns normally if it already exists.
   */
  ensureAgent = (input: CreateAgentInput): Promise<EnsureAgentResponse> => {
    return this.agentsClient.ensureAgent(input);
  };
}
