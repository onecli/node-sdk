import { OneCLIError } from "./errors.js";
import { Client } from "./container/index.js";
import type { OneCLIOptions } from "./types.js";

const DEFAULT_TIMEOUT = 5000;

export class OneCLI {
  private onecliUrl: string | undefined;
  private timeout: number;

  private _client: Client | undefined;

  constructor(options?: OneCLIOptions) {
    this.onecliUrl = options?.onecliUrl ?? process.env.ONECLI_URL;
    this.timeout = options?.timeout ?? DEFAULT_TIMEOUT;

    if (this.onecliUrl) {
      this._client = new Client(this.onecliUrl, this.timeout);
    }
  }

  /**
   * Access the OneCLI client for container configuration.
   * Throws if no OneCLI URL was configured.
   */
  client = (): Client => {
    if (!this._client) {
      throw new OneCLIError(
        'No OneCLI URL configured. Pass { onecliUrl: "..." } to OneCLI() or set the ONECLI_URL environment variable.',
      );
    }
    return this._client;
  };
}
