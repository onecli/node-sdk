import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

/** Host-side system CA bundle locations (in priority order). */
const SYSTEM_CA_PATHS = [
  "/etc/ssl/cert.pem", // macOS
  "/etc/ssl/certs/ca-certificates.crt", // Debian / Ubuntu
  "/etc/pki/tls/certs/ca-bundle.crt", // RHEL / CentOS / Fedora
];

/**
 * Build a combined CA bundle (system CAs + proxy CA) on the host.
 * Returns the path to the combined file, or `null` on failure.
 */
export function buildCombinedCaBundle(proxyCaHostPath: string): string | null {
  let proxyCa: string;
  try {
    proxyCa = readFileSync(proxyCaHostPath, "utf8");
  } catch {
    return null;
  }

  for (const sysPath of SYSTEM_CA_PATHS) {
    try {
      const sysCa = readFileSync(sysPath, "utf8");
      const combined = sysCa.trimEnd() + "\n" + proxyCa.trimEnd() + "\n";
      const outPath = join(dirname(proxyCaHostPath), "combined-ca.crt");
      writeFileSync(outPath, combined);
      return outPath;
    } catch {
      continue;
    }
  }

  return null;
}
