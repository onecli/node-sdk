export { OneCLI } from "./client.js";
export { Client } from "./container/index.js";
export { OneCLIError, OneCLIRequestError } from "./errors.js";

export type { OneCLIOptions } from "./types.js";
export type {
  ContainerConfig,
  ContainerMount,
  ApplyContainerConfigOptions,
} from "./container/types.js";

// ---------------------------------------------------------------------------
// Standalone convenience function
// ---------------------------------------------------------------------------

import { Client } from "./container/index.js";

/**
 * Standalone helper: fetch the container config from OneCLI and push the
 * corresponding `-e` and `-v` flags onto a Docker `run` argument array.
 *
 * Returns `true` if OneCLI was reachable and config was applied,
 * `false` otherwise.
 *
 * @param args       Docker `run` argument array to mutate.
 * @param onecliUrl  Base URL of OneCLI (e.g. "http://localhost:18080").
 *                   Pass `undefined` / `null` to skip (returns `false`).
 */
export async function applyOneCLIConfig(
  args: string[],
  onecliUrl?: string | null,
): Promise<boolean> {
  if (!onecliUrl) return false;
  const client = new Client(onecliUrl, 3000);
  return client.applyContainerConfig(args);
}
