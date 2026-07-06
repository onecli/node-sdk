import { afterEach, describe, expect, it, vi } from "vitest";
import { OrgApprovalClient } from "../../src/approvals/org.js";
import { OneCLIRequestError } from "../../src/index.js";
import type { OrgApprovalRequest } from "../../src/approvals/types.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const makeRequest = (
  overrides?: Partial<OrgApprovalRequest>,
): OrgApprovalRequest => ({
  id: "ap-1",
  projectId: "proj-1",
  method: "POST",
  url: "https://api.example.com/v1/send",
  host: "api.example.com",
  path: "/v1/send",
  headers: {},
  bodyPreview: null,
  agent: { id: "a-1", name: "Agent", externalId: null },
  createdAt: "2026-01-01T00:00:00Z",
  expiresAt: "2026-01-01T00:05:00Z",
  timeoutSeconds: 300,
  ...overrides,
});

const pollResponse = (requests: OrgApprovalRequest[]): Response =>
  new Response(JSON.stringify({ requests, timeoutSeconds: 300 }), {
    status: 200,
  });

/** A fetch that stays pending until its request is aborted, then rejects — so
 * the poll loop parks on the second poll instead of busy-spinning. */
const hangUntilAborted = (init?: RequestInit): Promise<Response> =>
  new Promise((_resolve, reject) => {
    const abort = () =>
      reject(new DOMException("The operation was aborted.", "AbortError"));
    const signal = init?.signal ?? undefined;
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort);
  });

const headersOf = (call: [unknown, unknown]): Record<string, string> =>
  (call[1] as { headers: Record<string, string> }).headers;

describe("OrgApprovalClient", () => {
  it("polls the org endpoint with bearer auth and no project header, then routes the decision to the request's own project", async () => {
    const request = makeRequest({ id: "ap-9", projectId: "proj-42" });
    let polls = 0;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        if (String(input).includes("/v1/org/approvals/pending")) {
          polls += 1;
          return polls === 1
            ? Promise.resolve(pollResponse([request]))
            : hangUntilAborted(init as RequestInit);
        }
        // decision endpoint
        return Promise.resolve(new Response(null, { status: 200 }));
      });

    const client = new OrgApprovalClient(
      "http://localhost:3000",
      "oc_org_key",
      "http://gw.local",
    );

    let seenProjectId: string | undefined;
    const started = client.start(async (req) => {
      seenProjectId = req.projectId;
      return "approve";
    });

    await vi.waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(([u]) => String(u).includes("/decision")),
      ).toBe(true);
    });

    client.stop();
    await started;

    // The callback saw the request's own project.
    expect(seenProjectId).toBe("proj-42");

    // Poll: org endpoint, bearer token, and crucially no X-Project-Id.
    const pollCall = fetchSpy.mock.calls.find(([u]) =>
      String(u).includes("/pending"),
    ) as [unknown, unknown];
    expect(String(pollCall[0])).toBe(
      "http://gw.local/v1/org/approvals/pending",
    );
    expect(headersOf(pollCall).Authorization).toBe("Bearer oc_org_key");
    expect(headersOf(pollCall)).not.toHaveProperty("X-Project-Id");

    // Decision: reuses the project decision route, scoped by X-Project-Id.
    const decisionCall = fetchSpy.mock.calls.find(([u]) =>
      String(u).includes("/decision"),
    ) as [unknown, unknown];
    expect(String(decisionCall[0])).toBe(
      "http://gw.local/v1/approvals/ap-9/decision",
    );
    expect(decisionCall[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ decision: "approve" }),
    });
    expect(headersOf(decisionCall)["X-Project-Id"]).toBe("proj-42");
  });

  it("passes poll failures to the onError hook instead of swallowing them", async () => {
    vi.useFakeTimers();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("unauthorized", { status: 401 }),
    );

    const errors: unknown[] = [];
    const client = new OrgApprovalClient(
      "http://localhost:3000",
      "oc_org_key",
      "http://gw.local",
    );
    const started = client.start(async () => "approve", {
      onError: (error) => errors.push(error),
    });

    // Flush the first (failing) poll and the onError callback.
    await vi.advanceTimersByTimeAsync(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(OneCLIRequestError);

    // Stop, then drain the 5s backoff so the loop exits cleanly.
    client.stop();
    await vi.advanceTimersByTimeAsync(5000);
    await started;
  });

  it("routes a gateway-URL resolution failure to onError (not just poll failures)", async () => {
    vi.useFakeTimers();

    // No preset gateway URL → the client must GET /v1/gateway-url first, which
    // fails. This must surface via onError and retry, not be swallowed.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("boom", { status: 500 }));

    const errors: unknown[] = [];
    const client = new OrgApprovalClient(
      "http://localhost:3000",
      "oc_org_key",
      null,
    );
    const started = client.start(async () => "approve", {
      onError: (error) => errors.push(error),
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(OneCLIRequestError);
    // It failed at resolution — the poll endpoint was never reached.
    expect(
      fetchSpy.mock.calls.every(([u]) =>
        String(u).includes("/v1/gateway-url"),
      ),
    ).toBe(true);

    client.stop();
    await vi.advanceTimersByTimeAsync(5000);
    await started;
  });
});
