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

describe("configureManualApproval", () => {
  it("does not keep calling a stopped handle's callback after configuring a new one", async () => {
    vi.useFakeTimers();

    // Every poll stays open until it is aborted or released below.
    const openPolls: Array<(res: Response) => void> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      if (!String(input).includes("/v1/approvals/pending")) {
        // decision endpoint
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      return new Promise((resolve, reject) => {
        const signal = (init as RequestInit | undefined)?.signal;
        signal?.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted.", "AbortError")),
        );
        openPolls.push(resolve);
      });
    });

    const onecli = new OneCLI({
      url: "http://localhost:3000",
      apiKey: "oc_key",
      gatewayUrl: "http://gw.local",
    });

    const oldSeen: string[] = [];
    const first = onecli.configureManualApproval(async (req) => {
      oldSeen.push(req.id);
      return "deny";
    });
    await vi.advanceTimersByTimeAsync(0);

    // Swap the handler: stop the first handle, register a new callback.
    first.stop();
    const newSeen: string[] = [];
    const second = onecli.configureManualApproval(async (req) => {
      newSeen.push(req.id);
      return "approve";
    });

    // Let any backoff elapse, then answer every poll still open.
    await vi.advanceTimersByTimeAsync(6000);
    const body = JSON.stringify({
      requests: [makeRequest({ id: "ap-1" })],
      timeoutSeconds: 300,
    });
    for (const resolve of openPolls.splice(0)) {
      resolve(new Response(body, { status: 200 }));
    }
    await vi.advanceTimersByTimeAsync(0);

    expect(oldSeen).toEqual([]);
    expect(newSeen).toEqual(["ap-1"]);

    second.stop();
    await vi.advanceTimersByTimeAsync(6000);
  });
});
