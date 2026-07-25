import { afterEach, describe, expect, it, vi } from "vitest";
import { OrgClient } from "../../src/org/index.js";
import { OneCLI, OneCLIError, OneCLIRequestError } from "../../src/index.js";

const client = () => new OrgClient("http://localhost:3000", "oc_org_key", 5000);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OrgClient.connectApp", () => {
  it("POSTs the connect body with bearer auth and no project header", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );

    const result = await client().connectApp("fireflies", {
      fields: { apiKey: "sk-1" },
      label: "shared",
    });

    expect(result).toEqual({ success: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/org/apps/fireflies/connect",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ fields: { apiKey: "sk-1" }, label: "shared" }),
      }),
    );
    const headers = (
      fetchSpy.mock.calls[0]?.[1] as { headers: Record<string, string> }
    ).headers;
    expect(headers.Authorization).toBe("Bearer oc_org_key");
    expect(headers).not.toHaveProperty("X-Project-Id");
  });

  it("maps a route-miss 404 to the Cloud/Enterprise availability error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "Unrecognized request URL",
            type: "invalid_request_error",
          },
        }),
        { status: 404 },
      ),
    );

    await expect(
      client().connectApp("fireflies", { fields: { apiKey: "sk" } }),
    ).rejects.toBeInstanceOf(OneCLIError);
  });

  it("keeps a resource-miss 404 as a request error with the server message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Connection not found", type: "not_found_error" },
        }),
        { status: 404 },
      ),
    );

    await expect(client().deleteConnection("gone")).rejects.toMatchObject({
      name: "OneCLIRequestError",
      statusCode: 404,
    });
  });

  it("surfaces the server's validation message on 400s", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "API Key is required" }), {
        status: 400,
      }),
    );

    await expect(
      client().connectApp("fireflies", { fields: { apiKey: "" } }),
    ).rejects.toThrow(/API Key is required/);
  });

  it("throws OneCLIRequestError with the status on other failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "API Key is required" }), {
        status: 400,
      }),
    );

    await expect(
      client().connectApp("fireflies", { fields: { apiKey: "" } }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("OrgClient.getAuthorizeUrl", () => {
  it("captures the redirect Location without following it", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://provider.example/oauth?state=abc" },
      }),
    );

    const url = await client().getAuthorizeUrl("github", {
      connectionId: "conn-1",
    });

    expect(url).toBe("https://provider.example/oauth?state=abc");
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/org/apps/github/authorize?connectionId=conn-1",
      expect.objectContaining({ method: "GET", redirect: "manual" }),
    );
  });

  it("rejects a non-redirect response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    await expect(client().getAuthorizeUrl("github")).rejects.toBeInstanceOf(
      OneCLIRequestError,
    );
  });
});

describe("OrgClient connections", () => {
  it("lists org connections filtered by provider", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify([{ id: "c1", provider: "gmail" }]), {
          status: 200,
        }),
      );

    const connections = await client().listConnections("gmail");

    expect(connections).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/org/connections?provider=gmail",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("renames a connection", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "c1", label: "prod" }), {
          status: 200,
        }),
      );

    const updated = await client().renameConnection("c1", "prod");

    expect(updated.label).toBe("prod");
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/org/connections/c1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ label: "prod" }),
      }),
    );
  });

  it("deletes a connection (204, no body)", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await expect(client().deleteConnection("c1")).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/org/connections/c1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("OrgClient effective app permissions", () => {
  it("reads the org reflection on the canonical path", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          provider: "gmail",
          basis: { agentId: null, credentialAttached: true, scope: "organization" },
          variesByIdentity: 2,
          groups: [
            {
              category: "write",
              verdict: "mixed",
              tools: [
                {
                  toolId: "send_email",
                  verdict: "blocked",
                  rateLimit: null,
                  rateLimitWindow: null,
                  decidedBy: {
                    scope: "organization",
                    rule: { logicalId: "l1", name: "No sends" },
                  },
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await client().getEffectiveAppPermissions({
      provider: "gmail",
    });

    expect(result.provider).toBe("gmail");
    expect(result.groups[0]!.tools[0]!.verdict).toBe("blocked");
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/org/policy/effective-app-permissions?provider=gmail",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("url-encodes the provider", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    await client().getEffectiveAppPermissions({ provider: "a/b?c" });

    expect(fetchSpy.mock.calls[0]![0]).toBe(
      "http://localhost:3000/v1/org/policy/effective-app-permissions?provider=a%2Fb%3Fc",
    );
  });
});

describe("the retired legacy rule surface", () => {
  it("is gone from the client — those endpoints answer 410 now", () => {
    // Cloud PR #709 deleted /v1/org/rules. Keeping methods that can only throw
    // would be worse than removing them, so this pins their absence: the
    // replacement is the *PolicyRule family plus the reflection above.
    const c = client() as unknown as Record<string, unknown>;
    for (const gone of [
      "listRules",
      "getRule",
      "createRule",
      "updateRule",
      "deleteRule",
    ]) {
      expect(c[gone]).toBeUndefined();
    }
    expect(typeof c.listPolicyRules).toBe("function");
    expect(typeof c.getEffectiveAppPermissions).toBe("function");
  });
});
describe("OneCLI facade", () => {
  it("exposes the org sub-client", () => {
    const onecli = new OneCLI({
      url: "http://localhost:3000",
      apiKey: "oc_org_key",
    });
    expect(onecli.org).toBeInstanceOf(OrgClient);
  });
});

describe("OrgClient policy engine", () => {
  const policyRule = {
    id: "r1",
    scope: "organization",
    status: "draft",
    generation: 0,
    priority: 0,
    enabled: true,
    isDefault: false,
    logicalId: "l1",
    source: "custom",
    name: "Block evil",
    description: null,
    action: "block",
    rateLimit: null,
    rateLimitWindow: null,
    requireApproval: false,
    conditions: null,
    identities: [],
    targets: [{ kind: "network", hostPattern: "evil.com" }],
    createdAt: "2026-01-01T00:00:00Z",
  };

  it("createPolicyRule POSTs the rule then publishes (auto-publish default)", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(policyRule), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ generation: 4, ruleCount: 3 }), {
          status: 200,
        }),
      );

    const outcome = await client().createPolicyRule({
      name: "Block evil",
      action: "block",
      targets: [{ kind: "network", hostPattern: "evil.com" }],
    });

    expect(outcome.published).toBe(true);
    expect(outcome.generation).toBe(4);
    expect(outcome.result.logicalId).toBe("l1");
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/v1/org/policy/rules",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/v1/org/policy/publish",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("skipPublish stages without publishing", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(policyRule), { status: 201 }),
      );

    const outcome = await client().createPolicyRule(
      {
        name: "Block evil",
        action: "block",
        targets: [{ kind: "network", hostPattern: "evil.com" }],
      },
      { skipPublish: true },
    );

    expect(outcome).toEqual({
      result: policyRule,
      published: false,
      generation: null,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("a publish failure after a successful write rethrows the publish error (the write stays staged)", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(policyRule), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "A staged rule needs a paid plan",
              type: "validation_error",
            },
          }),
          { status: 422 },
        ),
      );

    await expect(
      client().createPolicyRule({
        name: "Block evil",
        action: "block",
        targets: [{ kind: "network", hostPattern: "evil.com" }],
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("listPolicyRules carries the status query; reorder PUTs the full permutation", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify([policyRule]), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([policyRule]), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ generation: 5, ruleCount: 1 }), {
          status: 200,
        }),
      );

    await client().listPolicyRules("published");
    await client().reorderPolicyRules(["r1"]);

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/v1/org/policy/rules?status=published",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/v1/org/policy/rules/order",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ orderedIds: ["r1"] }),
      }),
    );
  });

  it("getPolicyLastPublish returns null when never published", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("null", { status: 200 }),
    );
    await expect(client().getPolicyLastPublish()).resolves.toBeNull();
  });

  it("updatePolicyRule PATCHes the encoded id with the input body then publishes", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(policyRule), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ generation: 6, ruleCount: 3 }), {
          status: 200,
        }),
      );

    const outcome = await client().updatePolicyRule("r 1", {
      enabled: false,
      rateLimit: null,
    });

    expect(outcome.published).toBe(true);
    expect(outcome.generation).toBe(6);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/v1/org/policy/rules/r%201",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ enabled: false, rateLimit: null }),
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/v1/org/policy/publish",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("deletePolicyRule DELETEs (204) then publishes, with a null result", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ generation: 7, ruleCount: 2 }), {
          status: 200,
        }),
      );

    const outcome = await client().deletePolicyRule("r1");

    expect(outcome).toEqual({ result: null, published: true, generation: 7 });
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/v1/org/policy/rules/r1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/v1/org/policy/publish",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("getPolicyDefault carries the status query; setPolicyDefault PATCHes the action then publishes", async () => {
    const defaultRule = { ...policyRule, isDefault: true, source: "default" };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(defaultRule), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(defaultRule), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ generation: 8, ruleCount: 2 }), {
          status: 200,
        }),
      );

    await client().getPolicyDefault("published");
    const outcome = await client().setPolicyDefault("block");

    expect(outcome.published).toBe(true);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/v1/org/policy/default?status=published",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/v1/org/policy/default",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ action: "block" }),
      }),
    );
  });

  it("getPolicyRule GETs the encoded draft id", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(policyRule), { status: 200 }),
      );

    const rule = await client().getPolicyRule("r/1");

    expect(rule.logicalId).toBe("l1");
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/org/policy/rules/r%2F1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("policy routes get the route-miss Cloud/Enterprise hint on community servers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "Unrecognized request URL (GET: /v1/org/policy/rules).",
            type: "invalid_request_error",
          },
        }),
        { status: 404 },
      ),
    );
    await expect(client().listPolicyRules()).rejects.toBeInstanceOf(
      OneCLIError,
    );
  });
});
