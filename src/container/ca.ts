import { readFileSync, writeFileSync } from "fs";
import { mkdirSync } from "fs";
import { tmpdir } from "os";
import { basename, dirname, join } from "path";

/** Host-side system CA bundle locations (in priority order). */
const SYSTEM_CA_PATHS = [
  "/etc/ssl/cert.pem", // macOS
  "/etc/ssl/certs/ca-certificates.crt", // Debian / Ubuntu
  "/etc/pki/tls/certs/ca-bundle.crt", // RHEL / CentOS / Fedora
];

/**
 * Write the proxy CA certificate PEM to a temp file on the host.
 * Returns the path to the written file.
 */
export function writeCaCertificate(caCertificate: string): string {
  const outPath = join(tmpdir(), "onecli-proxy-ca.pem");
  writeFileSync(outPath, caCertificate);
  return outPath;
}

/**
 * Write a credential stub to a temp file on the host.
 * Returns the path to the written file.
 */
export function writeCredentialStub(
  containerPath: string,
  content: string,
): string {
  const filename = `onecli-stub-${basename(containerPath)}`;
  const outDir = join(tmpdir(), "onecli-stubs");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, filename);
  writeFileSync(outPath, content, { mode: 0o600 });
  return outPath;
}

/**
 * Build a combined CA bundle (system CAs + OneCLI proxy CA) on the host.
 * Returns the path to the combined file, or `null` on failure.
 */
export function buildCombinedCaBundle(caCertificate: string): string | null {
  for (const sysPath of SYSTEM_CA_PATHS) {
    try {
      const sysCa = readFileSync(sysPath, "utf8");
      const combined = sysCa.trimEnd() + "\n" + caCertificate.trimEnd() + "\n";
      const outPath = join(tmpdir(), "onecli-combined-ca.pem");
      writeFileSync(outPath, combined);
      return outPath;
    } catch {
      continue;
    }
  }

  return null;
}
