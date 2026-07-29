import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OneCLI } from "../src/client.js";
import { OneCLIRequestError } from "../src/errors.js";

describe("OneCLI", () => {
  const originalUrl = process.env.ONECLI_URL;
  const originalApiKey = process.env.ONECLI_API_KEY;

  beforeEach(() => {
    delete process.env.ONECLI_URL;
    delete process.env.ONECLI_API_KEY;
  });

  afterEach(() => {
    if (originalUrl !== undefined) {
      process.env.ONECLI_URL = originalUrl;
    } else {
      delete process.env.ONECLI_URL;
    }
    if (originalApiKey !== undefined) {
      process.env.ONECLI_API_KEY = originalApiKey;
    } else {
      delete process.env.ONECLI_API_KEY;
    }
  });

  describe("constructor", () => {
    it("creates instance without apiKey (local mode)", () => {
      const oc = new OneCLI();
      expect(oc).toBeInstanceOf(OneCLI);
    });

    it("creates instance with empty apiKey", () => {
      const oc = new OneCLI({ apiKey: "" });
      expect(oc).toBeInstanceOf(OneCLI);
    });

    it("accepts apiKey from options", () => {
      const oc = new OneCLI({ apiKey: "oc_test123" });
      expect(oc).toBeInstanceOf(OneCLI);
    });

    it("falls back to ONECLI_API_KEY env var", () => {
      process.env.ONECLI_API_KEY = "oc_from_env";
      const oc = new OneCLI();
      expect(oc).toBeInstanceOf(OneCLI);
    });

    it("prefers options.apiKey over ONECLI_API_KEY env var", () => {
      process.env.ONECLI_API_KEY = "oc_from_env";

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ env: {}, caCertificate: "", caCertificateContainerPath: "" })),
      );

      const oc = new OneCLI({
        apiKey: "oc_from_options",
        url: "http://localhost:3000",
      });
      oc.getContainerConfig();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: "Bearer oc_from_options" },
        }),
      );

      fetchSpy.mockRestore();
    });

    it("omits auth header when no apiKey is provided", () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ env: {}, caCertificate: "", caCertificateContainerPath: "" })),
      );

      const oc = new OneCLI({ url: "http://localhost:3000" });
      oc.getContainerConfig();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {},
        }),
      );

      fetchSpy.mockRestore();
    });

    it("uses url from options when provided", () => {
      const oc = new OneCLI({
        apiKey: "oc_test",
        url: "http://localhost:3000",
      });
      expect(oc).toBeInstanceOf(OneCLI);
    });

    it("falls back to ONECLI_URL env var", () => {
      process.env.ONECLI_URL = "http://env-url:3000";
      const oc = new OneCLI({ apiKey: "oc_test" });
      expect(oc).toBeInstanceOf(OneCLI);
    });

    it("prefers options.url over ONECLI_URL env var", () => {
      process.env.ONECLI_URL = "http://env-url:3000";

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ env: {}, caCertificate: "", caCertificateContainerPath: "" })),
      );

      const oc = new OneCLI({
        apiKey: "oc_test",
        url: "http://options-url:3000",
      });
      oc.getContainerConfig();

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://options-url:3000/v1/container-config",
        expect.any(Object),
      );

      fetchSpy.mockRestore();
    });
  });

  describe("getContainerConfig", () => {
    it("delegates to ContainerClient", async () => {
      const mockConfig = {
        env: { HTTPS_PROXY: "http://proxy:8080" },
        caCertificate: "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
        caCertificateContainerPath: "/tmp/onecli-proxy-ca.pem",
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(mockConfig)),
      );

      const oc = new OneCLI({ apiKey: "oc_test", url: "http://localhost:3000" });
      const config = await oc.getContainerConfig();

      expect(config).toEqual(mockConfig);
      fetchSpy.mockRestore();
    });
  });

  describe("applyContainerConfig", () => {
    it("delegates to ContainerClient and returns boolean", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("connection refused"),
      );

      const oc = new OneCLI({ apiKey: "oc_test", url: "http://localhost:3000" });
      const result = await oc.applyContainerConfig([]);

      expect(result).toBe(false);
      fetchSpy.mockRestore();
    });
  });

  describe("createAgent", () => {
    it("delegates to AgentsClient", async () => {
      const mockResponse = {
        id: "clxyz123",
        name: "My Agent",
        identifier: "my-agent",
        createdAt: "2025-01-01T00:00:00.000Z",
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 201 }),
      );

      const oc = new OneCLI({ apiKey: "oc_test", url: "http://localhost:3000" });
      const agent = await oc.createAgent({ name: "My Agent", identifier: "my-agent" });

      expect(agent).toEqual(mockResponse);
      fetchSpy.mockRestore();
    });

    it("throws OneCLIRequestError on 409 conflict", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "identifier already exists" }), {
          status: 409,
          statusText: "Conflict",
        }),
      );

      const oc = new OneCLI({ apiKey: "oc_test", url: "http://localhost:3000" });

      await expect(oc.createAgent({ name: "Test", identifier: "test" })).rejects.toThrow(
        OneCLIRequestError,
      );
      fetchSpy.mockRestore();
    });
  });

  describe("grants facade", () => {
    // The README documents these on OneCLI itself — a method that exists only
    // on AgentsClient is invisible to users of `new OneCLI()`.
    it("exposes and delegates every grants method", async () => {
      const grants = {
        agentId: "a1",
        mode: "grants",
        connections: [],
        secrets: [],
      };
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(
          async () => new Response(JSON.stringify(grants), { status: 200 }),
        );

      const oc = new OneCLI({ apiKey: "oc_test", url: "http://localhost:3000" });
      await oc.getAgentGrants("a1");
      await oc.setConnectionGrant("a1", "c1", { access: "full" });
      await oc.attachSecret("a1", "s1");
      await oc.getConnectionGrants("c1");
      await oc.listAgentsWithGrants().catch(() => undefined); // array-shaped; delegation is what's pinned

      const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
      expect(urls).toContain("http://localhost:3000/v1/agents/a1/grants");
      expect(urls).toContain(
        "http://localhost:3000/v1/agents/a1/grants/connections/c1",
      );
      expect(urls).toContain(
        "http://localhost:3000/v1/agents/a1/grants/secrets/s1",
      );
      expect(urls).toContain("http://localhost:3000/v1/connections/c1/grants");
      expect(urls).toContain(
        "http://localhost:3000/v1/agents?include=grants-summary",
      );
      fetchSpy.mockRestore();
    });

    it("exposes and delegates both detach methods (204)", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(async () => new Response(null, { status: 204 }));

      const oc = new OneCLI({ apiKey: "oc_test", url: "http://localhost:3000" });
      await expect(oc.removeConnectionGrant("a1", "c1")).resolves.toBeUndefined();
      await expect(oc.detachSecret("a1", "s1")).resolves.toBeUndefined();
      expect(fetchSpy.mock.calls.map((c) => (c[1] as RequestInit).method)).toEqual([
        "DELETE",
        "DELETE",
      ]);
      fetchSpy.mockRestore();
    });
  });
});
