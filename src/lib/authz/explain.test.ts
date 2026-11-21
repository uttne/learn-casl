import { describe, expect, it } from "vitest";
import { explainDataAccess } from "@/lib/authz/explain";
import type { Feature, FeatureState } from "@/lib/authz/contract";

const enabled = {
  "projects.read": "enabled",
  "projects.create": "enabled",
  "projects.archive": "enabled",
  "documents.read": "enabled",
  "documents.create": "enabled",
  "documents.publish": "enabled",
  "audit.read": "enabled",
} as const satisfies Record<Feature, FeatureState>;

describe("explainDataAccess", () => {
  it("describes guest rows and replaced email", () => {
    const notes = explainDataAccess(
      { role: "guest", department: "engineering", clearance: 2 },
      { ...enabled, "audit.read": "disabled" },
    );
    expect(notes.join("\n")).toContain("他人の下書き");
    expect(notes.join("\n")).toContain("非公開");
    expect(notes.join("\n")).toContain("一つ上がマスク");
  });

  it("says rows are absent when the read API is hidden", () => {
    const notes = explainDataAccess(
      { role: "owner", department: "research", clearance: 3 },
      { ...enabled, "projects.read": "hidden", "documents.read": "hidden" },
    );
    expect(notes.filter((note) => note.includes("入口で止まる"))).toHaveLength(2);
  });
});
