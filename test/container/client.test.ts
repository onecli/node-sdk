import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tmpdir } from "os";
import { join } from "path";
import { ContainerClient } from "../../src/container/index.js";
import { OneCLIError, OneCLIRequestError } from "../../src/errors.js";

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

describe("ContainerClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  describe("constructor", () => {
    it("strips trailing slashes from baseUrl", () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_CONFIG)),
      );

      const client = new ContainerClient(
        "http://localhost:3000///",
        "oc_test",
        5000,
      );
      client.getContainerConfig();

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3000/api/container-config",
        expect.any(Object),
      );
    });
  });

  describe("getContainerConfig", () => {
    it("sends GET with correct URL and auth header", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_CONFIG)),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_mykey",
        5000,
      );
      await client.getContainerConfig();

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3000/api/container-config",
        expect.objectContaining({
          headers: { Authorization: "Bearer oc_mykey" },
        }),
      );
    });

    it("omits auth header when apiKey is empty", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_CONFIG)),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "",
        5000,
      );
      await client.getContainerConfig();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {},
        }),
      );
    });

    it("returns parsed ContainerConfig on success", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_CONFIG)),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );
      const config = await client.getContainerConfig();

      expect(config).toEqual(MOCK_CONFIG);
    });

    it("throws OneCLIRequestError on 401", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          statusText: "Unauthorized",
        }),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_bad",
        5000,
      );

      await expect(client.getContainerConfig()).rejects.toThrow(
        OneCLIRequestError,
      );
      await expect(client.getContainerConfig()).rejects.toMatchObject({
        statusCode: 401,
        url: "http://localhost:3000/api/container-config",
      });
    });

    it("throws OneCLIRequestError on 404", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "No default agent found." }), {
          status: 404,
          statusText: "Not Found",
        }),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );

      await expect(client.getContainerConfig()).rejects.toThrow(
        OneCLIRequestError,
      );
    });

    it("throws OneCLIRequestError on 500", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Internal server error" }), {
          status: 500,
          statusText: "Internal Server Error",
        }),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );

      const err = await client
        .getContainerConfig()
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(OneCLIRequestError);
      expect((err as OneCLIRequestError).statusCode).toBe(500);
    });

    it("wraps network errors into OneCLIError", async () => {
      fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new TypeError("fetch failed"));

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );

      await expect(client.getContainerConfig()).rejects.toThrow(OneCLIError);
      await expect(client.getContainerConfig()).rejects.toThrow("fetch failed");
    });

    it("re-throws OneCLIRequestError without wrapping", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("", { status: 503, statusText: "Service Unavailable" }),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );

      const err = await client
        .getContainerConfig()
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(OneCLIRequestError);
      // Verify it wasn't double-wrapped
      expect((err as OneCLIRequestError).name).toBe("OneCLIRequestError");
    });
  });

  describe("applyContainerConfig", () => {
    it("pushes -e flags for each env var", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_CONFIG)),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );
      const args: string[] = [];
      await client.applyContainerConfig(args, {
        combineCaBundle: false,
        addHostMapping: false,
      });

      expect(args).toContain("-e");
      expect(args).toContain(
        `HTTPS_PROXY=${MOCK_CONFIG.env.HTTPS_PROXY}`,
      );
      expect(args).toContain(
        `HTTP_PROXY=${MOCK_CONFIG.env.HTTP_PROXY}`,
      );
      expect(args).toContain(
        `NODE_EXTRA_CA_CERTS=${MOCK_CONFIG.env.NODE_EXTRA_CA_CERTS}`,
      );
      expect(args).toContain(
        `NODE_USE_ENV_PROXY=${MOCK_CONFIG.env.NODE_USE_ENV_PROXY}`,
      );
    });

    it("writes CA cert and pushes -v mount", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_CONFIG)),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );
      const args: string[] = [];
      await client.applyContainerConfig(args, {
        combineCaBundle: false,
        addHostMapping: false,
      });

      const expectedHostPath = join(tmpdir(), "onecli-proxy-ca.pem");
      const mountArg = args.find((a) => a.includes(":") && a.includes("onecli-proxy-ca.pem") && a.endsWith(":ro"));
      expect(mountArg).toBe(
        `${expectedHostPath}:${MOCK_CONFIG.caCertificateContainerPath}:ro`,
      );
    });

    it("builds combined CA bundle when combineCaBundle is true (default)", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_CONFIG)),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );
      const args: string[] = [];
      await client.applyContainerConfig(args, { addHostMapping: false });

      // On machines with a system CA bundle, SSL_CERT_FILE should be set
      const hasSslCertFile = args.some((a) => a.startsWith("SSL_CERT_FILE="));
      const hasCombinedMount = args.some((a) =>
        a.includes("onecli-combined-ca.pem"),
      );

      // Both should be present (or both absent if no system CA found)
      expect(hasSslCertFile).toBe(hasCombinedMount);
    });

    it("skips combined CA bundle when combineCaBundle is false", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_CONFIG)),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );
      const args: string[] = [];
      await client.applyContainerConfig(args, {
        combineCaBundle: false,
        addHostMapping: false,
      });

      expect(args.some((a) => a.includes("SSL_CERT_FILE"))).toBe(false);
      expect(args.some((a) => a.includes("combined-ca"))).toBe(false);
    });

    it("returns true on success", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_CONFIG)),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );
      const result = await client.applyContainerConfig([], {
        combineCaBundle: false,
        addHostMapping: false,
      });

      expect(result).toBe(true);
    });

    it("returns false when fetch fails (graceful degradation)", async () => {
      fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("connection refused"));

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );
      const args: string[] = [];
      const result = await client.applyContainerConfig(args);

      expect(result).toBe(false);
      expect(args).toEqual([]); // args should not be mutated on failure
    });

    it("returns false on 401 (bad API key)", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          statusText: "Unauthorized",
        }),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_invalid",
        5000,
      );
      const result = await client.applyContainerConfig([]);

      expect(result).toBe(false);
    });

    it("returns false on 503 (CA not available)", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ error: "CA certificate not available." }),
          { status: 503, statusText: "Service Unavailable" },
        ),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );
      const result = await client.applyContainerConfig([]);

      expect(result).toBe(false);
    });

    it("does not mutate args on failure", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          statusText: "Unauthorized",
        }),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );
      const args = ["run", "-i", "--rm"];
      const argsBefore = [...args];
      await client.applyContainerConfig(args);

      expect(args).toEqual(argsBefore);
    });

    it("preserves existing args and appends new ones", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_CONFIG)),
      );

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );
      const args = ["run", "-i", "--rm", "--name", "my-agent"];
      const originalLength = args.length;
      await client.applyContainerConfig(args, {
        combineCaBundle: false,
        addHostMapping: false,
      });

      // Original args preserved at the start
      expect(args.slice(0, originalLength)).toEqual([
        "run",
        "-i",
        "--rm",
        "--name",
        "my-agent",
      ]);
      // New args appended
      expect(args.length).toBeGreaterThan(originalLength);
    });

    it("adds --add-host on Linux", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_CONFIG)),
      );

      // Mock platform to linux
      const originalPlatform = Object.getOwnPropertyDescriptor(
        process,
        "platform",
      );
      Object.defineProperty(process, "platform", { value: "linux" });

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );
      const args: string[] = [];
      await client.applyContainerConfig(args, { combineCaBundle: false });

      expect(args).toContain("--add-host");
      expect(args).toContain("host.docker.internal:host-gateway");

      // Restore platform
      if (originalPlatform) {
        Object.defineProperty(process, "platform", originalPlatform);
      }
    });

    it("does not add --add-host on macOS", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_CONFIG)),
      );

      const originalPlatform = Object.getOwnPropertyDescriptor(
        process,
        "platform",
      );
      Object.defineProperty(process, "platform", { value: "darwin" });

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );
      const args: string[] = [];
      await client.applyContainerConfig(args, { combineCaBundle: false });

      expect(args).not.toContain("--add-host");

      if (originalPlatform) {
        Object.defineProperty(process, "platform", originalPlatform);
      }
    });

    it("skips --add-host when addHostMapping is false", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_CONFIG)),
      );

      const originalPlatform = Object.getOwnPropertyDescriptor(
        process,
        "platform",
      );
      Object.defineProperty(process, "platform", { value: "linux" });

      const client = new ContainerClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );
      const args: string[] = [];
      await client.applyContainerConfig(args, {
        combineCaBundle: false,
        addHostMapping: false,
      });

      expect(args).not.toContain("--add-host");

      if (originalPlatform) {
        Object.defineProperty(process, "platform", originalPlatform);
      }
    });
  });
});
