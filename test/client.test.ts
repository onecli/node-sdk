import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OneCLI } from "../src/client.js";
import { OneCLIError } from "../src/errors.js";

describe("OneCLI", () => {
  const originalEnv = process.env.ONECLI_URL;

  beforeEach(() => {
    delete process.env.ONECLI_URL;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ONECLI_URL = originalEnv;
    } else {
      delete process.env.ONECLI_URL;
    }
  });

  describe("constructor", () => {
    it("throws OneCLIError when apiKey is empty string", () => {
      expect(() => new OneCLI({ apiKey: "" })).toThrow(OneCLIError);
      expect(() => new OneCLI({ apiKey: "" })).toThrow("apiKey is required.");
    });

    it("accepts a valid apiKey", () => {
      const oc = new OneCLI({ apiKey: "oc_test123" });
      expect(oc).toBeInstanceOf(OneCLI);
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

      // We can verify by checking that fetch is called with the right URL
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
