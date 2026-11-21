import { defineAbilityFor, type AppAbility } from "@/lib/authz/ability";
import { presentDocument, type FieldAccess } from "@/lib/authz/fields";
import { toPersonaProfile } from "@/lib/authz/profile";
import { whereCan } from "@/lib/authz/rows";
import { prisma } from "@/lib/prisma";

const documentInclude = {
  author: { select: { id: true, name: true, email: true } },
  project: {
    select: {
      id: true,
      organizationId: true,
      ownerId: true,
      department: true,
      visibility: true,
      status: true,
    },
  },
} as const;

export type AccessMatrix = {
  projects: {
    id: string;
    title: string;
    department: string;
    visibility: "private" | "department" | "organization";
    status: "draft" | "active" | "archived";
    organization: { id: string; name: string; plan: "starter" | "business" | "enterprise" };
    owner: { id: string; name: string };
    documents: {
      id: string;
      title: string;
      body: string;
      classificationRank: number;
      status: "draft" | "published";
      author: { id: string; name: string; email: string };
    }[];
  }[];
  views: {
    userId: string;
    projects: {
      id: string;
      documents: {
        id: string;
        body: string;
        bodyAccess: FieldAccess;
        email: string;
        emailAccess: FieldAccess;
      }[];
    }[];
  }[];
};

/** Stored records beside the payload each account receives from the project API. */
export async function listAccessMatrix(): Promise<AccessMatrix> {
  const [projects, users] = await Promise.all([
    prisma.project.findMany({
      orderBy: [{ organization: { name: "asc" } }, { title: "asc" }],
      include: {
        organization: { select: { id: true, name: true, plan: true } },
        owner: { select: { id: true, name: true } },
        documents: {
          orderBy: [{ classificationRank: "asc" }, { title: "asc" }],
          include: { author: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: { email: "asc" },
      include: { memberships: true },
    }),
  ]);

  const views = await Promise.all(
    users.map(async (user) => {
      const visible = await listVisibleProjects(
        defineAbilityFor({
          id: user.id,
          memberships: user.memberships.map((membership) => ({
            organizationId: membership.organizationId,
            role: membership.role,
            department: membership.department,
            clearance: membership.clearance,
          })),
        }).data,
      );
      return {
        userId: user.id,
        projects: visible.map((project) => ({
          id: project.id,
          documents: project.documents.map((document) => ({
            id: document.id,
            body: document.body,
            bodyAccess: document.bodyAccess,
            email: document.author.email,
            emailAccess: document.emailAccess,
          })),
        })),
      };
    }),
  );

  return { projects, views };
}

export async function listPersonas() {
  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    include: { memberships: { include: { organization: true } } },
  });
  return users.map((user) => toPersonaProfile(user));
}

/** 契約を通過した組織に絞ったあと、行の WHERE で残し、文書は presentDocument で項目を変換します。 */
export async function listVisibleProjects(ability: AppAbility, organizationIds?: string[]) {
  const projects = await prisma.project.findMany({
    where: {
      AND: [
        whereCan(ability, "read", "Project"),
        ...(organizationIds ? [{ organizationId: { in: organizationIds } }] : []),
      ],
    },
    orderBy: { title: "asc" },
    include: {
      organization: { select: { id: true, name: true, plan: true } },
      owner: { select: { id: true, name: true } },
      documents: {
        where: whereCan(ability, "read", "Document"),
        orderBy: { title: "asc" },
        include: documentInclude,
      },
    },
  });

  return projects.map((project) => ({
    id: project.id,
    title: project.title,
    department: project.department,
    visibility: project.visibility,
    status: project.status,
    organization: project.organization,
    owner: project.owner,
    documents: project.documents.map((document) => ({
      ...presentDocument(ability, document),
      authorId: document.authorId,
      project: document.project,
    })),
  }));
}

export async function listVisibleAudit(ability: AppAbility, organizationIds: string[]) {
  const documents = await prisma.document.findMany({
    where: {
      AND: [
        whereCan(ability, "read", "Document"),
        { project: { is: { organizationId: { in: organizationIds } } } },
      ],
    },
    orderBy: { title: "asc" },
    include: documentInclude,
  });

  return documents.map((document) => ({
    projectId: document.projectId,
    ...presentDocument(ability, document),
  }));
}
