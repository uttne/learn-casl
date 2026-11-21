import { describe, expect, it } from "vitest";
import { defineAbilityFor, subject } from "@/lib/authz/ability";
import type { MembershipAttributes, Principal, ProjectStatus, ProjectVisibility } from "@/lib/authz/principal";

const ACME = "org_acme";
const NIMBUS = "org_nimbus";
const AOI = "user_aoi";
const BEN = "user_ben";
const CHLOE = "user_chloe";
const DANA = "user_dana";
const EVAN = "user_evan";
const FAYE = "user_faye";

function principal(id: string, memberships: MembershipAttributes[]): Principal {
  return { id, memberships };
}

function project(fields: {
  organizationId: string;
  ownerId: string;
  department: string;
  visibility: ProjectVisibility;
  status: ProjectStatus;
}) {
  return subject("Project", { id: "project", title: "Example", ...fields });
}

function document(fields: {
  authorId: string;
  classificationRank: number;
  status: "draft" | "published";
  project: ReturnType<typeof project>;
}) {
  return subject("Document", { id: "document", title: "Example", ...fields });
}

const platform = {
  organizationId: ACME,
  ownerId: CHLOE,
  department: "engineering",
  visibility: "organization" as const,
  status: "active" as const,
};

const sales = {
  organizationId: ACME,
  ownerId: DANA,
  department: "sales",
  visibility: "department" as const,
  status: "active" as const,
};

const benDraft = {
  organizationId: ACME,
  ownerId: BEN,
  department: "engineering",
  visibility: "private" as const,
  status: "draft" as const,
};

const study = {
  organizationId: NIMBUS,
  ownerId: FAYE,
  department: "research",
  visibility: "organization" as const,
  status: "active" as const,
};

const chloe = principal(CHLOE, [
  { organizationId: ACME, role: "member", department: "engineering", clearance: 2 },
]);
const ben = principal(BEN, [
  { organizationId: ACME, role: "admin", department: "engineering", clearance: 2 },
]);
const dana = principal(DANA, [
  { organizationId: ACME, role: "member", department: "sales", clearance: 1 },
]);
const evan = principal(EVAN, [
  { organizationId: ACME, role: "guest", department: "engineering", clearance: 2 },
]);
const aoi = principal(AOI, [
  { organizationId: ACME, role: "owner", department: "engineering", clearance: 3 },
  { organizationId: NIMBUS, role: "guest", department: "research", clearance: 1 },
]);
const faye = principal(FAYE, [
  { organizationId: NIMBUS, role: "owner", department: "research", clearance: 3 },
]);

describe("defineAbilityFor", () => {
  it("limits a member by organization, visibility, department, and clearance", () => {
    const ability = defineAbilityFor(chloe).data;

    expect(ability.can("read", project(platform))).toBe(true);
    expect(ability.can("read", project(sales))).toBe(false);
    expect(ability.can("read", project(benDraft))).toBe(false);
    expect(ability.can("read", project(study))).toBe(false);
    expect(
      ability.can(
        "read",
        document({
          authorId: CHLOE,
          classificationRank: 2,
          status: "draft",
          project: project(platform),
        }),
      ),
    ).toBe(true);
    const secret = document({
      authorId: AOI,
      classificationRank: 3,
      status: "published",
      project: project(platform),
    });
    expect(ability.can("read", secret)).toBe(true);
    expect(ability.can("view", secret, "body")).toBe(false);
    expect(ability.can("mask", secret, "body")).toBe(true);
    expect(
      ability.can("create", subject("Project", { ...platform, ownerId: CHLOE, department: "engineering" })),
    ).toBe(true);
    expect(
      ability.can("create", subject("Project", { ...platform, ownerId: CHLOE, department: "sales" })),
    ).toBe(false);
    expect(ability.can("archive", project({ ...platform, status: "archived" }))).toBe(false);
  });

  it("lets an admin cross departments without raising clearance", () => {
    const ability = defineAbilityFor(ben).data;

    expect(ability.can("read", project(sales))).toBe(true);
    expect(ability.can("read", project(benDraft))).toBe(true);
    expect(
      ability.can(
        "read",
        document({
          authorId: CHLOE,
          classificationRank: 2,
          status: "draft",
          project: project(platform),
        }),
      ),
    ).toBe(true);
    expect(
      ability.can(
        "publish",
        document({
          authorId: CHLOE,
          classificationRank: 2,
          status: "draft",
          project: project(platform),
        }),
      ),
    ).toBe(true);
    const secret = document({
      authorId: AOI,
      classificationRank: 3,
      status: "published",
      project: project(platform),
    });
    expect(ability.can("read", secret)).toBe(true);
    expect(ability.can("view", secret, "body")).toBe(false);
    expect(ability.can("mask", secret, "body")).toBe(true);
    expect(
      ability.can("create", subject("Project", { ...sales, ownerId: BEN })),
    ).toBe(true);
    expect(ability.can("manage", subject("Membership", { organizationId: ACME }))).toBe(false);
  });

  it("keeps a low clearance when the same person is only a guest in another organization", () => {
    const ability = defineAbilityFor(aoi).data;

    expect(
      ability.can(
        "read",
        document({
          authorId: AOI,
          classificationRank: 3,
          status: "published",
          project: project(platform),
        }),
      ),
    ).toBe(true);
    expect(ability.can("read", project(study))).toBe(true);
    expect(ability.can("update", project(study))).toBe(false);
    expect(
      ability.can(
        "read",
        document({
          authorId: FAYE,
          classificationRank: 1,
          status: "published",
          project: project(study),
        }),
      ),
    ).toBe(true);
    const nimbusSecret = document({
      authorId: FAYE,
      classificationRank: 3,
      status: "published",
      project: project(study),
    });
    expect(ability.can("read", nimbusSecret)).toBe(true);
    expect(ability.can("view", nimbusSecret, "body")).toBe(false);
    expect(ability.can("replace", nimbusSecret, "body")).toBe(true);
    expect(ability.can("view", nimbusSecret, "authorEmail")).toBe(false);
    expect(ability.can("manage", subject("Membership", { organizationId: ACME }))).toBe(true);
    expect(ability.can("manage", subject("Membership", { organizationId: NIMBUS }))).toBe(false);
  });

  it("hides other people's drafts from a guest and blocks creates", () => {
    const ability = defineAbilityFor(evan).data;

    expect(ability.can("read", project(platform))).toBe(true);
    expect(ability.can("read", project(benDraft))).toBe(false);
    expect(
      ability.can(
        "read",
        document({
          authorId: CHLOE,
          classificationRank: 2,
          status: "published",
          project: project(platform),
        }),
      ),
    ).toBe(true);
    expect(
      ability.can(
        "read",
        document({
          authorId: CHLOE,
          classificationRank: 2,
          status: "draft",
          project: project(platform),
        }),
      ),
    ).toBe(false);
    expect(
      ability.can("create", subject("Project", { ...platform, ownerId: EVAN })),
    ).toBe(false);
  });

  it("does not treat a low-clearance member as an organization-wide reader", () => {
    const ability = defineAbilityFor(dana).data;

    expect(ability.can("read", project(platform))).toBe(true);
    expect(ability.can("read", project(sales))).toBe(true);
    const runbook = document({
      authorId: CHLOE,
      classificationRank: 2,
      status: "published",
      project: project(platform),
    });
    expect(ability.can("read", runbook)).toBe(true);
    expect(ability.can("view", runbook, "body")).toBe(false);
    expect(ability.can("mask", runbook, "body")).toBe(true);
    expect(ability.can("read", project(study))).toBe(false);
  });

  it("isolates an owner from organizations they do not belong to", () => {
    const ability = defineAbilityFor(faye).data;

    expect(ability.can("read", project(study))).toBe(true);
    expect(ability.can("read", project(platform))).toBe(false);
  });

  it("fails closed when the user has no memberships", () => {
    const ability = defineAbilityFor(principal("nobody", [])).data;

    expect(ability.can("read", "Project")).toBe(false);
    expect(ability.can("read", project(platform))).toBe(false);
  });
});
