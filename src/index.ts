export { OneCLI } from "./client.js";
export { ContainerClient } from "./container/index.js";
export { OneCLIError, OneCLIRequestError } from "./errors.js";

export type { OneCLIOptions } from "./types.js";
export type {
  ContainerConfig,
  ApplyContainerConfigOptions,
} from "./container/types.js";

// ---------------------------------------------------------------------------
// Standalone convenience function
// ---------------------------------------------------------------------------

import { OneCLI } from "./client.js";

/**
 * Standalone helper: fetch the container config from OneCLI and push the
 * corresponding `-e` and `-v` flags onto a Docker `run` argument array.
 *
 * Returns `true` if OneCLI was reachable and config was applied,
 * `false` otherwise (including when `apiKey` is falsy).
 *
 * @param args    Docker `run` argument array to mutate.
 * @param apiKey  User API key (`oc_...`). Pass `undefined` / empty to skip.
 * @param url     Base URL of OneCLI. Defaults to `ONECLI_URL` env or `https://app.onecli.sh`.
 */
export async function applyOneCLIConfig(
  args: string[],
  apiKey?: string | null,
  url?: string,
): Promise<boolean> {
  if (!apiKey) return false;
  const oc = new OneCLI({ apiKey, url });
  return oc.applyContainerConfig(args);
}
