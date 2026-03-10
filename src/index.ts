export { OneCLI } from "./client.js";
export { ProxyClient } from "./proxy/index.js";
export { OneCLIError, OneCLIRequestError } from "./errors.js";

export type { OneCLIOptions } from "./types.js";
export type {
  ContainerConfig,
  ContainerMount,
  ApplyContainerConfigOptions,
} from "./proxy/types.js";

// ---------------------------------------------------------------------------
// Standalone convenience function
// ---------------------------------------------------------------------------

import { ProxyClient } from "./proxy/index.js";

/**
 * Standalone helper: fetch the proxy's container config and push the
 * corresponding `-e` and `-v` flags onto a Docker `run` argument array.
 *
 * Returns `true` if the proxy was reachable and config was applied,
 * `false` otherwise.
 *
 * @param args      Docker `run` argument array to mutate.
 * @param proxyUrl  Base URL of the proxy (e.g. "http://localhost:18080").
 *                  Pass `undefined` / `null` to skip (returns `false`).
 */
export async function applyProxyConfig(
  args: string[],
  proxyUrl?: string | null,
): Promise<boolean> {
  if (!proxyUrl) return false;
  const client = new ProxyClient(proxyUrl, 3000);
  return client.applyContainerConfig(args);
}
