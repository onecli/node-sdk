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

describe("OrgClient rules", () => {
  it("creates an org rule", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "r1", name: "block sends" }), {
          status: 201,
        }),
      );

    const rule = await client().createRule({
      name: "block sends",
      hostPattern: "gmail.googleapis.com",
      action: "block",
      enabled: true,
    });

    expect(rule.id).toBe("r1");
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/org/rules",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("decodes mixed rule listings: masked app-permission rules + custom rules", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "app-1",
            name: "Gmail: Send email",
            action: "manual_approval",
            enabled: true,
            rateLimit: null,
            rateLimitWindow: null,
            scope: "organization",
            metadata: {
              source: "app_permission",
              provider: "gmail",
              toolId: "send_email",
            },
            createdAt: "2026-07-04T00:00:00Z",
          },
          {
            id: "custom-1",
            name: "Block deletes",
            hostPattern: "api.example.com",
            pathPattern: "/v1/*",
            method: "DELETE",
            action: "block",
            enabled: true,
            rateLimit: null,
            rateLimitWindow: null,
            scope: "organization",
            metadata: null,
            createdAt: "2026-07-04T00:00:00Z",
          },
        ]),
        { status: 200 },
      ),
    );

    const rules = await client().listRules();

    const appRule = rules[0]!;
    expect(appRule.hostPattern).toBeUndefined();
    expect(appRule.pathPattern).toBeUndefined();
    expect(appRule.method).toBeUndefined();
    expect(appRule.metadata).toEqual({
      source: "app_permission",
      provider: "gmail",
      toolId: "send_email",
    });

    const custom = rules[1]!;
    expect(custom.hostPattern).toBe("api.example.com");
    expect(custom.pathPattern).toBe("/v1/*");
    expect(custom.method).toBe("DELETE");
  });

  it("lists, gets, updates, and deletes rules on the canonical paths", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        const call = fetchSpy.mock.calls.at(-1);
        const isDelete =
          (call?.[1] as { method?: string } | undefined)?.method === "DELETE";
        return isDelete
          ? new Response(null, { status: 204 })
          : new Response(JSON.stringify({ success: true }), { status: 200 });
      });

    await client().updateRule("r1", { enabled: false, pathPattern: null });
    await client().listRules();
    await client().getRule("r1");
    await client().deleteRule("r1");

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/v1/org/rules/r1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ enabled: false, pathPattern: null }),
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/v1/org/rules",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3000/v1/org/rules/r1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      4,
      "http://localhost:3000/v1/org/rules/r1",
      expect.objectContaining({ method: "DELETE" }),
    );
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
