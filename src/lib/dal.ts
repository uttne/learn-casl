import type { AppAbility } from "@/lib/authz/ability";
import { subject } from "@/lib/authz/ability";
import { accessibleBy, type AppActions } from "@/lib/authz/casl";
import {
  featureMap,
  type FeatureGate,
  type GateDenial,
} from "@/lib/authz/gate";
import { presentDocument, type PresentedDocument } from "@/lib/authz/present";
import type { Feature } from "@/lib/authz/contract";
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

export async function listPersonas() {
  return prisma.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, description: true },
  });
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
