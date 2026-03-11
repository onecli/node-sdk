import { describe, it, expect, vi, afterEach } from "vitest";
import { applyOneCLIConfig } from "../src/index.js";

const MOCK_CONFIG = {
  env: {
    HTTPS_PROXY: "http://x:aoc_token@proxy:18080",
    HTTP_PROXY: "http://x:aoc_token@proxy:18080",
    NODE_EXTRA_CA_CERTS: "/tmp/onecli-proxy-ca.pem",
    NODE_USE_ENV_PROXY: "1",
  },
  caCertificate:
    "-----BEGIN CERTIFICATE-----\nTEST_CA\n-----END CERTIFICATE-----",
  caCertificateContainerPath: "/tmp/onecli-proxy-ca.pem",
};

describe("applyOneCLIConfig", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it("returns false when apiKey is null", async () => {
    const args: string[] = [];
    const result = await applyOneCLIConfig(args, null);
    expect(result).toBe(false);
    expect(args).toEqual([]);
  });

  it("returns false when apiKey is undefined", async () => {
    const args: string[] = [];
    const result = await applyOneCLIConfig(args, undefined);
    expect(result).toBe(false);
    expect(args).toEqual([]);
  });

  it("returns false when apiKey is empty string", async () => {
    const args: string[] = [];
    const result = await applyOneCLIConfig(args, "");
    expect(result).toBe(false);
    expect(args).toEqual([]);
  });

  it("returns true and mutates args on success", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_CONFIG)),
    );

    const args = ["run", "-i", "--rm"];
    const result = await applyOneCLIConfig(
      args,
      "oc_test",
      "http://localhost:3000",
    );

    expect(result).toBe(true);
    expect(args.length).toBeGreaterThan(3);
    expect(args).toContain("-e");
  });

  it("returns false when server is unreachable", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("ECONNREFUSED"));

    const args = ["run", "-i", "--rm"];
    const result = await applyOneCLIConfig(
      args,
      "oc_test",
      "http://localhost:3000",
    );

    expect(result).toBe(false);
  });

  it("passes url to the OneCLI client", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_CONFIG)),
    );

    await applyOneCLIConfig([], "oc_test", "http://custom:4000");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://custom:4000/api/container-config",
      expect.any(Object),
    );
  });

  it("passes apiKey as Bearer token", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_CONFIG)),
    );

    await applyOneCLIConfig([], "oc_mykey123", "http://localhost:3000");

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: "Bearer oc_mykey123" },
      }),
    );
  });
});
