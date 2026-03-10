import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

/** Host-side system CA bundle locations (in priority order). */
const SYSTEM_CA_PATHS = [
  "/etc/ssl/cert.pem", // macOS
  "/etc/ssl/certs/ca-certificates.crt", // Debian / Ubuntu
  "/etc/pki/tls/certs/ca-bundle.crt", // RHEL / CentOS / Fedora
];

/**
 * Build a combined CA bundle (system CAs + OneCLI CA) on the host.
 * Returns the path to the combined file, or `null` on failure.
 */
export function buildCombinedCaBundle(onecliCaHostPath: string): string | null {
  let onecliCa: string;
  try {
    onecliCa = readFileSync(onecliCaHostPath, "utf8");
  } catch {
    return null;
  }

  for (const sysPath of SYSTEM_CA_PATHS) {
    try {
      const sysCa = readFileSync(sysPath, "utf8");
      const combined = sysCa.trimEnd() + "\n" + onecliCa.trimEnd() + "\n";
      const outPath = join(dirname(onecliCaHostPath), "combined-ca.crt");
      writeFileSync(outPath, combined);
      return outPath;
    } catch {
      continue;
    }
  }

  return null;
}
