import { afterAll, describe, expect, it } from "vitest";
import { defineAbilityFor } from "@/lib/authz/ability";
import { whereCan } from "@/lib/authz/rows";
import { listAccessMatrix, listVisibleProjects } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

async function abilityFor(email: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    include: { memberships: true },
  });
  return defineAbilityFor({
    id: user.id,
    memberships: user.memberships.map((membership) => ({
      organizationId: membership.organizationId,
      role: membership.role,
      department: membership.department,
      clearance: membership.clearance,
    })),
  }).data;
}

async function titlesFor(email: string) {
  const projects = await listVisibleProjects(await abilityFor(email));
  return projects.map((project) => ({
    title: project.title,
    documents: project.documents.map((document) => document.title),
  }));
}

describe("accessible queries", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns the rows each persona can read", async () => {
    await expect(titlesFor("chloe@acme.test")).resolves.toEqual([
      {
        title: "Platform API",
        documents: ["Confidential keys", "Internal design", "Public overview", "Runbook"],
      },
    ]);

    await expect(titlesFor("dana@acme.test")).resolves.toEqual([
      { title: "Platform API", documents: ["Confidential keys", "Public overview", "Runbook"] },
      { title: "Sales pipeline", documents: ["Q4 forecast"] },
    ]);

    await expect(titlesFor("evan@acme.test")).resolves.toEqual([
      { title: "Platform API", documents: ["Confidential keys", "Public overview", "Runbook"] },
    ]);

    await expect(titlesFor("ben@acme.test")).resolves.toEqual([
      { title: "Ben draft", documents: ["Scratch note"] },
      {
        title: "Platform API",
        documents: ["Confidential keys", "Internal design", "Public overview", "Runbook"],
      },
      { title: "Sales pipeline", documents: ["Q4 forecast"] },
    ]);

    await expect(titlesFor("aoi@acme.test")).resolves.toEqual([
      { title: "Ben draft", documents: ["Scratch note"] },
      {
        title: "Platform API",
        documents: ["Confidential keys", "Internal design", "Public overview", "Runbook"],
      },
      { title: "Sales pipeline", documents: ["Q4 forecast"] },
      {
        title: "Vaccine study",
        documents: ["Confidential results", "Public abstract"],
      },
    ]);

    await expect(titlesFor("faye@nimbus.test")).resolves.toEqual([
      {
        title: "Vaccine study",
        documents: ["Confidential results", "Public abstract"],
      },
    ]);
  });

  it("keeps the stored records next to each account's API payload", async () => {
    const matrix = await listAccessMatrix();
    expect(matrix.projects.map((project) => project.title)).toEqual([
      "Ben draft",
      "Platform API",
      "Sales pipeline",
      "Vaccine study",
    ]);
    const stored = matrix.projects
      .find((project) => project.title === "Platform API")
      ?.documents.find((document) => document.title === "Confidential keys");
    expect(stored?.body).toBe("本番の鍵の所在です。");

    const dana = await prisma.user.findUniqueOrThrow({ where: { email: "dana@acme.test" } });
    const view = matrix.views.find((item) => item.userId === dana.id);
    const returnedTitles = matrix.projects
      .filter((project) => view?.projects.some((item) => item.id === project.id))
      .map((project) => project.title);
    expect(returnedTitles).toEqual(["Platform API", "Sales pipeline"]);
    const keys = view?.projects
      .flatMap((project) => project.documents)
      .find((document) => document.id === stored?.id);
    expect(keys).toMatchObject({ body: "この等級の本文は表示できません", bodyAccess: "replaced", emailAccess: "visible" });
  });

  it("masks or replaces fields on rows that stay in the result", async () => {
    const projects = await listVisibleProjects(await abilityFor("dana@acme.test"));
    const platform = projects.find((project) => project.title === "Platform API");
    expect(platform?.documents.map((document) => [document.title, document.bodyAccess, document.emailAccess])).toEqual([
      ["Confidential keys", "replaced", "visible"],
      ["Public overview", "visible", "visible"],
      ["Runbook", "masked", "visible"],
    ]);
  });

  it("returns nothing when no rule matches", async () => {
    const ability = defineAbilityFor({ id: "nobody", memberships: [] }).data;
    await expect(listVisibleProjects(ability)).resolves.toEqual([]);
  });

  it("updates only rows the action allows, then restores them", async () => {
    const platform = await prisma.project.findFirstOrThrow({
      where: { title: "Platform API" },
    });
    const design = await prisma.document.findFirstOrThrow({
      where: { title: "Internal design" },
    });
    const evan = await abilityFor("evan@acme.test");
    const chloe = await abilityFor("chloe@acme.test");
    const ben = await abilityFor("ben@acme.test");
    const dana = await abilityFor("dana@acme.test");

    try {
      const lowClearancePublish = await prisma.document.updateMany({
        where: { AND: [{ id: design.id }, whereCan(dana, "publish", "Document")] },
        data: { status: "published" },
      });
      expect(lowClearancePublish.count).toBe(0);

      const adminPublish = await prisma.document.updateMany({
        where: { AND: [{ id: design.id }, whereCan(ben, "publish", "Document")] },
        data: { status: "published" },
      });
      expect(adminPublish.count).toBe(1);

      const guestArchive = await prisma.project.updateMany({
        where: { AND: [{ id: platform.id }, whereCan(evan, "archive", "Project")] },
        data: { status: "archived" },
      });
      expect(guestArchive.count).toBe(0);

      const ownerArchive = await prisma.project.updateMany({
        where: { AND: [{ id: platform.id }, whereCan(chloe, "archive", "Project")] },
        data: { status: "archived" },
      });
      expect(ownerArchive.count).toBe(1);
    } finally {
      await prisma.project.update({
        where: { id: platform.id },
        data: { status: "active" },
      });
      await prisma.document.update({
        where: { id: design.id },
        data: { status: "draft" },
      });
    }
  });
});
