import { describe, it, expect } from "vitest";
import { OneCLI, OneCLIError, ContainerClient } from "../src/index.js";

describe("package exports", () => {
  it("exports OneCLI class", () => {
    expect(OneCLI).toBeDefined();
  });

  it("exports OneCLIError", () => {
    expect(OneCLIError).toBeDefined();
  });

  it("exports ContainerClient", () => {
    expect(ContainerClient).toBeDefined();
  });
});
