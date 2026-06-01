import { mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, join } from "path";

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
