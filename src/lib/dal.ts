import { defineAbilityFor, subject, type AppAbility } from "@/lib/authz/ability";
import { accessibleBy, type AppActions } from "@/lib/authz/casl";
import {
  featureMap,
  type FeatureGate,
  type GateDenial,
} from "@/lib/authz/gate";
import { presentDocument, type FieldAccess, type PresentedDocument } from "@/lib/authz/present";
import type { Feature } from "@/lib/authz/contract";
import { toPersonaProfile } from "@/lib/authz/profile";
import { prisma } from "@/lib/prisma";

type SubjectName = "Organization" | "Membership" | "Project" | "Document";

/** Put this first inside `AND` so an empty CASL condition short-circuits. */
export function whereCan<T extends SubjectName>(ability: AppAbility, action: AppActions, subjectType: T) {
  return accessibleBy(ability, action).ofType(subjectType);
}

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

export function actionState(
  gate: FeatureGate,
  feature: Feature,
  organizationId: string,
  allowedOnRow: boolean,
): "hidden" | "disabled" | "enabled" {
  const state = featureMap(gate, organizationId)[feature];
  if (state !== "enabled") return state;
  return allowedOnRow ? "enabled" : "disabled";
}

export function projectArchiveState(
  gate: FeatureGate,
  ability: AppAbility,
  project: {
    id: string;
    title: string;
    organizationId: string;
    ownerId: string;
    department: string;
    visibility: "private" | "department" | "organization";
    status: "draft" | "active" | "archived";
  },
) {
  return actionState(
    gate,
    "projects.archive",
    project.organizationId,
    ability.can("archive", subject("Project", project)),
  );
}

export function documentPublishState(
  gate: FeatureGate,
  ability: AppAbility,
  document: PresentedDocument & {
    authorId: string;
    project: {
      id: string;
      organizationId: string;
      ownerId: string;
      department: string;
      visibility: "private" | "department" | "organization";
      status: "draft" | "active" | "archived";
    };
  },
) {
  return actionState(
    gate,
    "documents.publish",
    document.project.organizationId,
    ability.can(
      "publish",
      subject("Document", {
        id: document.id,
        title: document.title,
        authorId: document.authorId,
        classificationRank: document.classificationRank,
        status: document.status,
        project: document.project,
      }),
    ),
  );
}

export function denialResponse(denial: GateDenial) {
  return Response.json({ error: denial.error, layer: denial.layer }, { status: denial.status });
}

export function attributeDenied(error: string) {
  return Response.json({ error, layer: "attribute" }, { status: 403 });
}
