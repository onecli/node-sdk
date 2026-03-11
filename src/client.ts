import { OneCLIError } from "./errors.js";
import { ContainerClient } from "./container/index.js";
import type { OneCLIOptions } from "./types.js";
import type { ApplyContainerConfigOptions, ContainerConfig } from "./container/types.js";

const DEFAULT_URL = "https://app.onecli.sh";
const DEFAULT_TIMEOUT = 5000;

export class OneCLI {
  private containerClient: ContainerClient;

  constructor(options: OneCLIOptions) {
    if (!options.apiKey) {
      throw new OneCLIError("apiKey is required.");
    }

    const url = options.url ?? process.env.ONECLI_URL ?? DEFAULT_URL;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;

    this.containerClient = new ContainerClient(url, options.apiKey, timeout);
  }

  /**
   * Fetch the raw container configuration from OneCLI.
   */
  getContainerConfig = (): Promise<ContainerConfig> => {
    return this.containerClient.getContainerConfig();
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
}
