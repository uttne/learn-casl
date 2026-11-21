import { describe, expect, it } from "vitest";
import { defineAbilityFor } from "@/lib/authz/ability";
import { featureState } from "@/lib/authz/contract";
import { authorizeFeature, authorizeFeatureSomewhere } from "@/lib/authz/gate";
import type { Principal } from "@/lib/authz/principal";

const ACME = "org_acme";
const NIMBUS = "org_nimbus";

function accessFor(principal: Principal) {
  return defineAbilityFor(principal);
}

describe("feature gates", () => {
  it("hides features the contract does not include", () => {
    expect(featureState(false, true)).toBe("hidden");
    expect(featureState(true, false)).toBe("disabled");
    expect(featureState(true, true)).toBe("enabled");
  });

  it("returns 404 when no organization contract includes the operation", () => {
    const faye = accessFor({
      id: "faye",
      memberships: [{ organizationId: NIMBUS, role: "owner", department: "research", clearance: 3 }],
    });
    const decision = authorizeFeatureSomewhere(
      {
        api: faye.api,
        organizations: [{ id: NIMBUS, name: "Nimbus", plan: "starter" }],
      },
      "projects.create",
    );
    expect(decision).toMatchObject({ ok: false, status: 404, layer: "contract" });
  });

  it("returns 403 when the contract includes the operation and ABAC does not", () => {
    const evan = accessFor({
      id: "evan",
      memberships: [{ organizationId: ACME, role: "guest", department: "engineering", clearance: 2 }],
    });
    const decision = authorizeFeature(
      {
        api: evan.api,
        organizations: [{ id: ACME, name: "Acme", plan: "enterprise" }],
      },
      ACME,
      "projects.create",
    );
    expect(decision).toMatchObject({ ok: false, status: 403, layer: "resource" });
  });

  it("allows the operation when both the contract and ABAC allow it", () => {
    const ben = accessFor({
      id: "ben",
      memberships: [{ organizationId: ACME, role: "admin", department: "engineering", clearance: 2 }],
    });
    const decision = authorizeFeatureSomewhere(
      {
        api: ben.api,
        organizations: [{ id: ACME, name: "Acme", plan: "enterprise" }],
      },
      "audit.read",
    );
    expect(decision).toEqual({ ok: true, organizationIds: [ACME] });
  });
});
