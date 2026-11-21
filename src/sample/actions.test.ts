import { describe, expect, it } from "vitest";
import { screenFeatureState, type SamplePersona } from "@/sample/actions";

function persona(features: SamplePersona["organizations"][number]["features"][]): SamplePersona {
  return {
    id: "user",
    name: "User",
    organizations: features.map((feature, index) => ({
      id: String(index),
      name: `Org ${index}`,
      department: "engineering",
      features: feature,
    })),
  };
}

const hidden = {
  "projects.read": "hidden",
  "projects.create": "hidden",
  "projects.archive": "hidden",
  "documents.read": "hidden",
  "documents.create": "hidden",
  "documents.publish": "hidden",
  "audit.read": "hidden",
} as const;

describe("screen feature state", () => {
  it("keeps a feature enabled when one organization allows it", () => {
    const state = screenFeatureState(
      persona([{ ...hidden, "projects.create": "enabled" }, { ...hidden }]),
      "projects.create",
    );
    expect(state).toBe("enabled");
  });

  it("disables a feature that the contract includes but the attributes reject", () => {
    const state = screenFeatureState(persona([{ ...hidden, "audit.read": "disabled" }]), "audit.read");
    expect(state).toBe("disabled");
  });

  it("hides a feature missing from every contract", () => {
    expect(screenFeatureState(persona([{ ...hidden }]), "projects.create")).toBe("hidden");
  });
});
