import { afterEach, describe, expect, it, vi } from "vitest";
import { OneCLI } from "../../src/index.js";
import type { ApprovalRequest } from "../../src/approvals/types.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const makeRequest = (
  overrides?: Partial<ApprovalRequest>,
): ApprovalRequest => ({
  id: "ap-1",
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

/** A fetch that stays pending until its request is aborted, then rejects — so
 * the poll loop parks on the next poll instead of busy-spinning. */
const hangUntilAborted = (init?: RequestInit): Promise<Response> =>
  new Promise((_resolve, reject) => {
    const abort = () =>
      reject(new DOMException("The operation was aborted.", "AbortError"));
    const signal = init?.signal ?? undefined;
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort);
  });

describe("configureManualApproval", () => {
  it("retries a failed gateway-URL resolution instead of giving up on polling", async () => {
    vi.useFakeTimers();

    const request = makeRequest({ id: "ap-7" });
    let resolutions = 0;
    let polls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes("/v1/gateway-url")) {
        resolutions += 1;
        // OneCLI is not reachable yet on the first attempt.
        return resolutions === 1
          ? Promise.resolve(new Response("unavailable", { status: 503 }))
          : Promise.resolve(
              new Response(JSON.stringify({ url: "http://gw.local/" }), {
                status: 200,
              }),
            );
      }
      if (url.includes("/v1/approvals/pending")) {
        polls += 1;
        return polls === 1
          ? Promise.resolve(
              new Response(
                JSON.stringify({ requests: [request], timeoutSeconds: 300 }),
                { status: 200 },
              ),
            )
          : hangUntilAborted(init as RequestInit);
      }
      // decision endpoint
      return Promise.resolve(new Response(null, { status: 200 }));
    });

    const onecli = new OneCLI({
      url: "http://localhost:3000",
      apiKey: "oc_key",
    });
    const seen: string[] = [];
    const handle = onecli.configureManualApproval(async (req) => {
      seen.push(req.id);
      return "approve";
    });

    // First resolution fails; after the 5s backoff it succeeds and polls.
    await vi.advanceTimersByTimeAsync(5000);

    expect(resolutions).toBe(2);
    expect(seen).toEqual(["ap-7"]);

    handle.stop();
    await vi.advanceTimersByTimeAsync(0);
  });
});
