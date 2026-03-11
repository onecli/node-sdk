import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OneCLI } from "../src/client.js";
import { OneCLIError } from "../src/errors.js";

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
    it("throws OneCLIError when no apiKey is provided and env var is not set", () => {
      expect(() => new OneCLI()).toThrow(OneCLIError);
      expect(() => new OneCLI()).toThrow("apiKey is required");
    });

    it("throws OneCLIError when apiKey is empty string and env var is not set", () => {
      expect(() => new OneCLI({ apiKey: "" })).toThrow(OneCLIError);
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
        "http://options-url:3000/api/container-config",
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
});
