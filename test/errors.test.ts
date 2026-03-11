import { describe, it, expect } from "vitest";
import { OneCLIError, OneCLIRequestError, toOneCLIError } from "../src/errors.js";

describe("OneCLIError", () => {
  it("sets name and message", () => {
    const err = new OneCLIError("something went wrong");
    expect(err.name).toBe("OneCLIError");
    expect(err.message).toBe("something went wrong");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("OneCLIRequestError", () => {
  it("sets name, url, statusCode, and formatted message", () => {
    const err = new OneCLIRequestError("Not Found", {
      url: "http://localhost:3000/api/container-config",
      statusCode: 404,
    });
    expect(err.name).toBe("OneCLIRequestError");
    expect(err.url).toBe("http://localhost:3000/api/container-config");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe(
      "[URL=http://localhost:3000/api/container-config] [StatusCode=404] Not Found",
    );
    expect(err).toBeInstanceOf(Error);
  });
});

describe("toOneCLIError", () => {
  it("passes through OneCLIError unchanged", () => {
    const original = new OneCLIError("test");
    const result = toOneCLIError(original);
    expect(result).toBe(original);
  });

  it("passes through OneCLIRequestError unchanged", () => {
    const original = new OneCLIRequestError("test", {
      url: "http://x",
      statusCode: 500,
    });
    const result = toOneCLIError(original);
    expect(result).toBe(original);
  });

  it("wraps a generic Error into OneCLIError", () => {
    const result = toOneCLIError(new TypeError("fetch failed"));
    expect(result).toBeInstanceOf(OneCLIError);
    expect(result.message).toBe("fetch failed");
  });

  it("wraps a string into OneCLIError", () => {
    const result = toOneCLIError("something broke");
    expect(result).toBeInstanceOf(OneCLIError);
    expect(result.message).toBe("something broke");
  });

  it("wraps a number into OneCLIError", () => {
    const result = toOneCLIError(42);
    expect(result).toBeInstanceOf(OneCLIError);
    expect(result.message).toBe("42");
  });

  it("wraps null into OneCLIError", () => {
    const result = toOneCLIError(null);
    expect(result).toBeInstanceOf(OneCLIError);
    expect(result.message).toBe("null");
  });
});
