import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentsClient } from "../../src/agents/index.js";
import { OneCLIRequestError } from "../../src/errors.js";
import type { AgentGrants } from "../../src/agents/types.js";

// The grants surface replaces the retired equipment writes, so the properties
// that matter are the exact PATH (the old twins are 410 now) and the wire BODY
// (the server requires both arrays on a custom grant).

const GRANTS: AgentGrants = {
  agentId: "a1",
  mode: "grants",
  connections: [
    {
      connectionId: "c1",
      provider: "gmail",
      label: "Work",
      scope: "project",
      access: "custom",
      allow: ["search_messages"],
      ask: ["send_email"],
    },
  ],
  secrets: [
    { secretId: "s1", name: "STRIPE_KEY", type: "generic", scope: "project" },
  ],
};

let spy: ReturnType<typeof vi.spyOn>;

// A Response body can only be read once, so mint a fresh one per call —
// mockResolvedValue would hand the same exhausted object to a second call.
const arm = (body: unknown, status = 200) => {
  spy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async () =>
        new Response(status === 204 ? null : JSON.stringify(body), { status }),
    );
};

const client = () =>
  new AgentsClient("http://localhost:3000", "oc_test", 5000, "proj_1");

afterEach(() => {
  spy?.mockRestore();
});

describe("grants", () => {
  it("getAgentGrants hits the canonical path and decodes both arms", async () => {
    arm(GRANTS);
    const result = await client().getAgentGrants("a1");
    expect(result.connections[0]!.access).toBe("custom");
    expect(result.secrets[0]!.name).toBe("STRIPE_KEY");
    expect(spy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/agents/a1/grants",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("setConnectionGrant PUTs the full body verbatim", async () => {
    arm(GRANTS);
    await client().setConnectionGrant("a1", "c1", { access: "full" });
    expect(spy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/agents/a1/grants/connections/c1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ access: "full" }),
      }),
    );
  });

  it("setConnectionGrant PUTs a custom body with both arrays", async () => {
    arm(GRANTS);
    await client().setConnectionGrant("a1", "c1", {
      access: "custom",
      allow: ["get_message"],
      ask: [],
    });
    expect(spy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/agents/a1/grants/connections/c1",
      expect.objectContaining({
        body: JSON.stringify({ access: "custom", allow: ["get_message"], ask: [] }),
      }),
    );
  });

  it("removeConnectionGrant handles the bare 204", async () => {
    arm(null, 204);
    await expect(
      client().removeConnectionGrant("a1", "c1"),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/agents/a1/grants/connections/c1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("attachSecret PUTs with no body (assign-only)", async () => {
    arm(GRANTS);
    await client().attachSecret("a1", "s1");
    const init = spy.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("PUT");
    expect("body" in init).toBe(false);
    expect(spy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/agents/a1/grants/secrets/s1",
      expect.anything(),
    );
  });

  it("detachSecret handles the bare 204", async () => {
    arm(null, 204);
    await expect(client().detachSecret("a1", "s1")).resolves.toBeUndefined();
  });

  it("getConnectionGrants hits the connection orientation", async () => {
    arm({ connectionId: "c1", agents: [] });
    const result = await client().getConnectionGrants("c1");
    expect(result.connectionId).toBe("c1");
    expect(spy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/connections/c1/grants",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("listAgentsWithGrants sends the include param", async () => {
    arm([
      {
        id: "a1",
        name: "Cody",
        identifier: "cody",
        isDefault: true,
        createdAt: "2026-07-01T00:00:00.000Z",
        grantsSummary: {
          mode: "grants",
          entries: [
            { kind: "app", provider: "gmail", connectionId: "c1", label: "Work" },
            { kind: "llm", id: "s2", name: "ANTHROPIC_KEY" },
          ],
          total: 2,
        },
      },
    ]);
    const result = await client().listAgentsWithGrants();
    expect(result[0]!.grantsSummary.total).toBe(2);
    expect(result[0]!.grantsSummary.entries[0]!.kind).toBe("app");
    expect(spy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/agents?include=grants-summary",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("path segments are encoded (no traversal into sibling routes)", async () => {
    arm(GRANTS);
    await client().getAgentGrants("a/../b");
    expect(spy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/agents/a%2F..%2Fb/grants",
      expect.anything(),
    );
    spy.mockRestore();
    arm(GRANTS);
    await client().setConnectionGrant("a1", "c/../x", { access: "full" });
    expect(spy).toHaveBeenCalledWith(
      "http://localhost:3000/v1/agents/a1/grants/connections/c%2F..%2Fx",
      expect.anything(),
    );
  });

  it("surfaces the server's error-envelope message on a 422", async () => {
    const msg = "A tool can't be both always-allowed and require approval.";
    arm({ error: { message: msg, type: "validation_error" } }, 422);
    const err = await client()
      .setConnectionGrant("a1", "c1", {
        access: "custom",
        allow: ["send_email"],
        ask: ["send_email"],
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OneCLIRequestError);
    expect((err as OneCLIRequestError).statusCode).toBe(422);
    expect((err as Error).message).toContain(msg);
  });

  it("surfaces the 410 pointer message from a retired endpoint", async () => {
    const msg =
      "PATCH /v1/agents/:agentId/secret-mode was removed: agents are always selective now.";
    arm({ error: { message: msg, type: "invalid_request_error" } }, 410);
    const err = await client()
      .getAgentGrants("a1")
      .catch((e: unknown) => e);
    expect((err as OneCLIRequestError).statusCode).toBe(410);
    expect((err as Error).message).toContain("agents are always selective");
  });

  it("sends X-Project-Id on every grants call", async () => {
    arm(GRANTS);
    await client().getAgentGrants("a1");
    const init = spy.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-Project-Id"]).toBe(
      "proj_1",
    );
  });
});
