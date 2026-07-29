import { describe, it, expect, vi, afterEach } from "vitest";
import { AgentsClient } from "../../src/agents/index.js";
import { OneCLIError, OneCLIRequestError } from "../../src/errors.js";

const MOCK_AGENT = {
  id: "clxyz123abc",
  name: "My Agent",
  identifier: "my-agent",
  createdAt: "2025-01-01T00:00:00.000Z",
};

const MOCK_LIST_AGENT = {
  id: "clxyz123abc",
  name: "My Agent",
  identifier: "my-agent",
  isDefault: false,
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
        null,
      );
      client.createAgent({ name: "Test", identifier: "test" });

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3000/v1/agents",
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
        null,
      );
      await client.createAgent({ name: "My Agent", identifier: "my-agent" });

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3000/v1/agents",
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

      const client = new AgentsClient("http://localhost:3000", "", 5000, null);
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
        null,
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
        null,
      );

      await expect(
        client.createAgent({ name: "Test", identifier: "test" }),
      ).rejects.toThrow(OneCLIRequestError);

      await expect(
        client.createAgent({ name: "Test", identifier: "test" }),
      ).rejects.toMatchObject({
        statusCode: 401,
        url: "http://localhost:3000/v1/agents",
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
        null,
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
        null,
      );

      await expect(
        client.createAgent({ name: "Test", identifier: "test" }),
      ).rejects.toThrow(OneCLIError);
      await expect(
        client.createAgent({ name: "Test", identifier: "test" }),
      ).rejects.toThrow("fetch failed");
    });

    it("re-throws OneCLIRequestError on 500 without wrapping", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("", { status: 500, statusText: "Internal Server Error" }),
      );

      const client = new AgentsClient(
        "http://localhost:3000",
        "oc_test",
        5000,
        null,
      );

      const err = await client
        .createAgent({ name: "Test", identifier: "test" })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(OneCLIRequestError);
      expect((err as OneCLIRequestError).name).toBe("OneCLIRequestError");
    });
  });

  describe("listAgents", () => {
    it("sends GET with correct URL and auth header", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([MOCK_LIST_AGENT]), { status: 200 }),
      );

      const client = new AgentsClient(
        "http://localhost:3000",
        "oc_mykey",
        5000,
        null,
      );
      await client.listAgents();

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3000/v1/agents",
        expect.objectContaining({
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer oc_mykey",
          },
        }),
      );
    });

    it("returns parsed array on success", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([MOCK_LIST_AGENT]), { status: 200 }),
      );

      const client = new AgentsClient(
        "http://localhost:3000",
        "oc_test",
        5000,
        null,
      );
      const agents = await client.listAgents();

      expect(agents).toEqual([MOCK_LIST_AGENT]);
    });

    it("throws OneCLIRequestError on 401", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          statusText: "Unauthorized",
        }),
      );

      const client = new AgentsClient("http://localhost:3000", "oc_bad", 5000, null);

      const err = await client.listAgents().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(OneCLIRequestError);
      expect((err as OneCLIRequestError).statusCode).toBe(401);
    });

    it("wraps network errors into OneCLIError", async () => {
      fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new TypeError("fetch failed"));

      const client = new AgentsClient(
        "http://localhost:3000",
        "oc_test",
        5000,
        null,
      );

      await expect(client.listAgents()).rejects.toThrow(OneCLIError);
    });
  });

  describe("ensureAgent", () => {
    it("returns created: true when agent is newly created", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(MOCK_AGENT), { status: 201 }),
      );

      const client = new AgentsClient(
        "http://localhost:3000",
        "oc_test",
        5000,
        null,
      );
      const result = await client.ensureAgent({
        name: "My Agent",
        identifier: "my-agent",
      });

      expect(result).toEqual({
        name: "My Agent",
        identifier: "my-agent",
        created: true,
      });
    });

    it("returns created: false when agent already exists (409)", async () => {
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
        null,
      );
      const result = await client.ensureAgent({
        name: "My Agent",
        identifier: "my-agent",
      });

      expect(result).toEqual({
        name: "My Agent",
        identifier: "my-agent",
        created: false,
      });
    });

    it("returns created: false on 403 when the agent already exists", async () => {
      // At the agent cap the server may return 403 (quota) instead of 409 for
      // an existing identifier. ensureAgent confirms existence via GET /agents.
      fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "agents limit reached" }), {
            status: 403,
            statusText: "Forbidden",
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify([MOCK_LIST_AGENT]), { status: 200 }),
        );

      const client = new AgentsClient(
        "http://localhost:3000",
        "oc_test",
        5000,
        null,
      );
      const result = await client.ensureAgent({
        name: "My Agent",
        identifier: "my-agent",
      });

      expect(result).toEqual({
        name: "My Agent",
        identifier: "my-agent",
        created: false,
      });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("re-throws the 403 when the agent does not exist (genuine quota cap)", async () => {
      fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "agents limit reached" }), {
            status: 403,
            statusText: "Forbidden",
          }),
        )
        .mockResolvedValueOnce(
          // Listing exists but does not include the requested identifier.
          new Response(
            JSON.stringify([{ ...MOCK_LIST_AGENT, identifier: "other" }]),
            { status: 200 },
          ),
        );

      const client = new AgentsClient(
        "http://localhost:3000",
        "oc_test",
        5000,
        null,
      );

      const err = await client
        .ensureAgent({ name: "My Agent", identifier: "my-agent" })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(OneCLIRequestError);
      expect((err as OneCLIRequestError).statusCode).toBe(403);
    });

    it("re-throws the original 403 when the existence check itself fails", async () => {
      fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "agents limit reached" }), {
            status: 403,
            statusText: "Forbidden",
          }),
        )
        .mockResolvedValueOnce(
          new Response("", { status: 500, statusText: "Internal Server Error" }),
        );

      const client = new AgentsClient(
        "http://localhost:3000",
        "oc_test",
        5000,
        null,
      );

      const err = await client
        .ensureAgent({ name: "My Agent", identifier: "my-agent" })
        .catch((e: unknown) => e);
      // The original 403 surfaces, not the 500 from the existence check.
      expect(err).toBeInstanceOf(OneCLIRequestError);
      expect((err as OneCLIRequestError).statusCode).toBe(403);
    });

    it("throws on non-409 errors", async () => {
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
        null,
      );

      await expect(
        client.ensureAgent({ name: "Test", identifier: "test" }),
      ).rejects.toThrow(OneCLIRequestError);
    });

    it("throws on network errors", async () => {
      fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new TypeError("fetch failed"));

      const client = new AgentsClient(
        "http://localhost:3000",
        "oc_test",
        5000,
        null,
      );

      await expect(
        client.ensureAgent({ name: "Test", identifier: "test" }),
      ).rejects.toThrow(OneCLIError);
    });
  });
});

describe("read-only policy reflections", () => {
  // These replace the retired per-agent equipment reads. The property that
  // matters is the PATH — a wrong one silently returns another resource's shape
  // or a 404, and the old paths are 410 now.
  let spy: ReturnType<typeof vi.spyOn>;
  afterEach(() => spy?.mockRestore());

  const client = () =>
    new AgentsClient("http://localhost:3000", "oc_test", 5000, null);

  // A Response body can only be read once, so mint a fresh one per call —
  // mockResolvedValue would hand the same exhausted object to a second call.
  const arm = (body: unknown) => {
    spy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => new Response(JSON.stringify(body), { status: 200 }),
      );
  };

  it("getEffectiveCredentials hits the agent reflection and decodes both arms", async () => {
    arm({
      agentId: "a1",
      mode: "selective",
      secrets: [
        {
          kind: "secret",
          id: "s1",
          name: "Anthropic key",
          host: "api.anthropic.com",
          status: "usable",
          provenance: [
            {
              kind: "rule",
              scope: "project",
              rule: { logicalId: "l1", name: "Anthropic key" },
            },
          ],
        },
      ],
      connections: [],
    });

    const result = await client().getEffectiveCredentials("a1");

    expect(result.mode).toBe("selective");
    expect(result.secrets[0]!.kind).toBe("secret");
    expect(spy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/agents/a1/effective-credentials",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("getConnectionAgentAccess hits the connection reflection", async () => {
    arm({ connectionId: "c1", provider: "github", catalog: true, agents: [] });

    const result = await client().getConnectionAgentAccess("c1");

    expect(result.provider).toBe("github");
    expect(spy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/connections/c1/effective-agents",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("listAppPermissionDefinitions hits the catalog", async () => {
    arm([{ provider: "gmail", groups: [] }]);

    const result = await client().listAppPermissionDefinitions();

    expect(result[0]!.provider).toBe("gmail");
    expect(spy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/apps/permission-definitions",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("getEffectiveAppPermissions hits the PROJECT reflection, agentId optional", async () => {
    arm({ provider: "gmail", basis: { agentId: null, credentialAttached: true, scope: "project" }, variesByIdentity: 0, groups: [] });
    await client().getEffectiveAppPermissions({ provider: "gmail" });
    expect(spy.mock.calls[0]![0]).toBe(
      "http://localhost:3000/v1/policy/effective-app-permissions?provider=gmail",
    );

    spy.mockClear();
    await client().getEffectiveAppPermissions({ provider: "gmail", agentId: "a1" });
    expect(spy.mock.calls[0]![0]).toBe(
      "http://localhost:3000/v1/policy/effective-app-permissions?provider=gmail&agentId=a1",
    );
  });

  it("url-encodes ids so a slash cannot escape the path", async () => {
    arm({});
    await client().getEffectiveCredentials("a/../b");
    expect(spy.mock.calls[0]![0]).toBe(
      "http://localhost:3000/v1/agents/a%2F..%2Fb/effective-credentials",
    );
  });

  it("maps a non-2xx to OneCLIRequestError with the status", async () => {
    spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("gone", { status: 410 }));

    await expect(client().getEffectiveCredentials("a1")).rejects.toThrow(
      OneCLIRequestError,
    );
  });
});
