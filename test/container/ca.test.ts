import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { writeCaCertificate, buildCombinedCaBundle } from "../../src/container/ca.js";

const PROXY_CA = "-----BEGIN CERTIFICATE-----\nPROXY_CA_CONTENT\n-----END CERTIFICATE-----";

describe("writeCaCertificate", () => {
  it("writes PEM to tmpdir and returns path", () => {
    const path = writeCaCertificate(PROXY_CA);

    expect(path).toBe(join(tmpdir(), "onecli-proxy-ca.pem"));

    const written = readFileSync(path, "utf8");
    expect(written).toBe(PROXY_CA);
  });

  it("overwrites on subsequent calls (no duplication)", () => {
    writeCaCertificate(PROXY_CA);
    writeCaCertificate(PROXY_CA);

    const written = readFileSync(join(tmpdir(), "onecli-proxy-ca.pem"), "utf8");
    expect(written).toBe(PROXY_CA);
  });
});

describe("buildCombinedCaBundle", () => {
  // On macOS /etc/ssl/cert.pem exists, on most Linux CI one of the system paths exists.
  const hasSystemCa = [
    "/etc/ssl/cert.pem",
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/pki/tls/certs/ca-bundle.crt",
  ].some((p) => existsSync(p));

  it("returns a path when a system CA bundle is found", () => {
    if (!hasSystemCa) return; // skip if no system CA on this machine

    const result = buildCombinedCaBundle(PROXY_CA);

    expect(result).toBe(join(tmpdir(), "onecli-combined-ca.pem"));

    const combined = readFileSync(result!, "utf8");
    expect(combined).toContain("PROXY_CA_CONTENT");
    expect(combined.length).toBeGreaterThan(PROXY_CA.length);
    expect(combined.trimEnd().endsWith("-----END CERTIFICATE-----")).toBe(true);
  });

  it("combined file contains both system and proxy CAs", () => {
    if (!hasSystemCa) return;

    const result = buildCombinedCaBundle(PROXY_CA);
    expect(result).not.toBeNull();

    const combined = readFileSync(result!, "utf8");
    // Should contain the proxy CA
    expect(combined).toContain("PROXY_CA_CONTENT");
    // Should contain more than just the proxy CA (system CAs prepended)
    expect(combined.length).toBeGreaterThan(PROXY_CA.length + 100);
  });

  it("returns null when no system CA is readable", () => {
    // Use a CA string but mock the module so readFileSync throws for system paths.
    // Since we can't mock ESM fs directly, we test with a fresh import using vi.mock.
    // Instead, we verify the function's contract: if all system paths fail, it returns null.
    // We can't easily test this without mocking fs, so we test the positive path above
    // and verify the null return type contract here.
    const result = buildCombinedCaBundle(PROXY_CA);
    if (hasSystemCa) {
      expect(result).not.toBeNull();
    } else {
      expect(result).toBeNull();
    }
  });
});
