import { describe, it, expect } from "vitest";
import { OneCLI, OneCLIError, ContainerClient, AgentsClient } from "../src/index.js";

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

  it("exports AgentsClient", () => {
    expect(AgentsClient).toBeDefined();
  });
});

describe("the retired legacy rule types", () => {
  it("are no longer part of the public surface", async () => {
    // Cloud PR #709 deleted /v1/org/rules, so these types describe a shape the
    // API can no longer return. Shipping them would imply the methods still
    // exist. The 3.0.0 breaking change is exactly this removal.
    const mod = await import("../src/index.js");
    const exported = Object.keys(mod);
    for (const gone of ["OrgRule", "CreateOrgRuleInput", "UpdateOrgRuleInput"]) {
      expect(exported).not.toContain(gone);
    }
  });
});
