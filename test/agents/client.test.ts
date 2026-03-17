import { describe, it, expect, vi, afterEach } from "vitest";
import { AgentsClient } from "../../src/agents/index.js";
import { OneCLIError, OneCLIRequestError } from "../../src/errors.js";

const MOCK_AGENT = {
  id: "clxyz123abc",
  name: "My Agent",
  identifier: "my-agent",
  createdAt: "2025-01-01T00:00:00.000Z",
};

describe("AgentsClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  describe("constructor", () => {
    it("strips trailing slashes from baseUrl", () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_AGENT), { status: 201 }),
      );

      const client = new AgentsClient(
        "http://localhost:3000///",
        "oc_test",
        5000,
      );
      client.createAgent({ name: "Test", identifier: "test" });

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3000/api/agents",
        expect.any(Object),
      );
    });
  });

  describe("createAgent", () => {
    it("sends POST with correct URL, auth header, and body", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_AGENT), { status: 201 }),
      );

      const client = new AgentsClient(
        "http://localhost:3000",
        "oc_mykey",
        5000,
      );
      await client.createAgent({ name: "My Agent", identifier: "my-agent" });

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3000/api/agents",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer oc_mykey",
          },
          body: JSON.stringify({ name: "My Agent", identifier: "my-agent" }),
        }),
      );
    });

    it("omits auth header when apiKey is empty", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_AGENT), { status: 201 }),
      );

      const client = new AgentsClient("http://localhost:3000", "", 5000);
      await client.createAgent({ name: "Test", identifier: "test" });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    it("returns parsed response on success", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_AGENT), { status: 201 }),
      );

      const client = new AgentsClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );
      const agent = await client.createAgent({
        name: "My Agent",
        identifier: "my-agent",
      });

      expect(agent).toEqual(MOCK_AGENT);
    });

    it("throws OneCLIRequestError on 401", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          statusText: "Unauthorized",
        }),
      );

      const client = new AgentsClient(
        "http://localhost:3000",
        "oc_bad",
        5000,
      );

      await expect(
        client.createAgent({ name: "Test", identifier: "test" }),
      ).rejects.toThrow(OneCLIRequestError);

      await expect(
        client.createAgent({ name: "Test", identifier: "test" }),
      ).rejects.toMatchObject({
        statusCode: 401,
        url: "http://localhost:3000/api/agents",
      });
    });

    it("throws OneCLIRequestError on 409 conflict", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ error: "identifier already exists" }),
          { status: 409, statusText: "Conflict" },
        ),
      );

      const client = new AgentsClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );

      const err = await client
        .createAgent({ name: "Test", identifier: "test" })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(OneCLIRequestError);
      expect((err as OneCLIRequestError).statusCode).toBe(409);
    });

    it("wraps network errors into OneCLIError", async () => {
      fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new TypeError("fetch failed"));

      const client = new AgentsClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );

      await expect(
        client.createAgent({ name: "Test", identifier: "test" }),
      ).rejects.toThrow(OneCLIError);
      await expect(
        client.createAgent({ name: "Test", identifier: "test" }),
      ).rejects.toThrow("fetch failed");
    });

    it("re-throws OneCLIRequestError without wrapping", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("", { status: 500, statusText: "Internal Server Error" }),
      );

      const client = new AgentsClient(
        "http://localhost:3000",
        "oc_test",
        5000,
      );

      const err = await client
        .createAgent({ name: "Test", identifier: "test" })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(OneCLIRequestError);
      expect((err as OneCLIRequestError).name).toBe("OneCLIRequestError");
    });
  });
});
