import { describe, expect, it } from "vitest";

import {
  CONNECTION_ID_HEADER,
  CONNECTIONS_HEADER,
  parseGatewayError,
} from "../../src/gateway/types.js";

// parseGatewayError narrows a parsed proxied-response body. The negative arms
// matter as much as the positive ones: a management-API envelope and an
// ordinary provider error must NOT be mistaken for a gateway error.

const CHOICE = {
  id: "conn_1",
  label: "Work",
  provider: "gmail",
  display_name: "Gmail",
};

describe("parseGatewayError", () => {
  it("narrows multiple_connections and keeps the retry fields", () => {
    const body = {
      error: "multiple_connections",
      message: "Multiple Google Mail accounts are connected.",
      connections: [CHOICE],
      header: "x-onecli-connection-id",
      example: "x-onecli-connection-id: conn_1",
    };
    const parsed = parseGatewayError(body);
    expect(parsed?.error).toBe("multiple_connections");
    if (parsed?.error === "multiple_connections") {
      expect(parsed.connections[0]?.id).toBe("conn_1");
      expect(parsed.header).toBe(CONNECTION_ID_HEADER);
    }
  });

  it("narrows multiple_providers the same way", () => {
    const parsed = parseGatewayError({
      error: "multiple_providers",
      message: "Accounts from more than one app match this request.",
      connections: [CHOICE],
      header: "x-onecli-connection-id",
      example: "x-onecli-connection-id: conn_1",
    });
    expect(parsed?.error).toBe("multiple_providers");
  });

  it("narrows connection_not_found (the stale-id case, no example field)", () => {
    const parsed = parseGatewayError({
      error: "connection_not_found",
      message: "No available connection matches that id.",
      connections: [CHOICE],
      header: "x-onecli-connection-id",
    });
    expect(parsed?.error).toBe("connection_not_found");
  });

  it("narrows access_restricted with its manage_url", () => {
    const parsed = parseGatewayError({
      error: "access_restricted",
      message: "This agent has no grant for the Gmail connection.",
      provider: "gmail",
      manage_url: "https://app.onecli.sh/connections/apps/gmail",
    });
    if (parsed?.error === "access_restricted") {
      expect(parsed.manage_url).toContain("/connections/apps/gmail");
    } else {
      expect.unreachable("expected access_restricted");
    }
  });

  it("narrows both policy blocks (rule_name only on the named one)", () => {
    const named = parseGatewayError({
      error: "blocked_by_policy",
      message: "Blocked by rule.",
      rule_name: "No deletes",
      method: "DELETE",
      path: "/gmail/v1/users/me/messages/abc",
      dashboard_url: "https://app.onecli.sh/agents",
    });
    expect(named?.error).toBe("blocked_by_policy");

    const unnamed = parseGatewayError({
      error: "blocked_by_default_policy",
      message: "Nothing allows this request.",
      method: "POST",
      host: "api.stripe.com",
      path: "/v1/charges",
      dashboard_url: "https://app.onecli.sh/agents",
    });
    expect(unnamed?.error).toBe("blocked_by_default_policy");
  });

  it("narrows credential_not_found", () => {
    const parsed = parseGatewayError({
      error: "credential_not_found",
      message: "No credential exists for this host.",
      hostname: "api.stripe.com",
      path: "/v1/charges",
      secret_url: "https://app.onecli.sh/secrets/new?hostname=api.stripe.com",
    });
    expect(parsed?.error).toBe("credential_not_found");
  });

  it("rejects the management-API error envelope", () => {
    expect(
      parseGatewayError({
        error: { message: "Agent not found", type: "invalid_request_error" },
      }),
    ).toBeNull();
  });

  it("rejects ordinary provider errors and non-objects", () => {
    expect(parseGatewayError({ error: "invalid_grant" })).toBeNull();
    expect(parseGatewayError({ message: "rate limited" })).toBeNull();
    expect(parseGatewayError("upstream text body")).toBeNull();
    expect(parseGatewayError(null)).toBeNull();
    expect(parseGatewayError(undefined)).toBeNull();
    expect(parseGatewayError(42)).toBeNull();
  });

  it("exports the two protocol header names", () => {
    expect(CONNECTION_ID_HEADER).toBe("x-onecli-connection-id");
    expect(CONNECTIONS_HEADER).toBe("x-onecli-connections");
  });
});
