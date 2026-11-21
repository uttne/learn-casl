import { AbilityBuilder, createMongoAbility, subject, type ForcedSubject, type MongoAbility } from "@casl/ability";
import type { Prisma } from "@/generated/prisma/client";
import { createPrismaAbility, type AppAbility } from "@/lib/authz/casl";
import type { ApiOperation, ApiResource } from "@/lib/authz/contract";
import type { MembershipAttributes, Principal } from "@/lib/authz/principal";

export { subject };
export type { AppAbility };

export type ApiSubject = {
  resource: ApiResource;
  operation: ApiOperation;
  organizationId: string;
} & ForcedSubject<"Api">;

export type ApiAbility = MongoAbility<["access", "Api" | ApiSubject]>;

export type Access = {
  data: AppAbility;
  api: ApiAbility;
};

/**
 * `data` answers which rows and fields exist for this principal.
 * `api` answers which API operations the principal may invoke in an organization.
 * Contract entitlements are applied separately, before these abilities.
 */
export function defineAbilityFor(principal: Principal): Access {
  return {
    data: defineDataAbility(principal),
    api: defineApiAbility(principal),
  };
}

function defineApiAbility(principal: Principal): ApiAbility {
  const { can, build } = new AbilityBuilder<ApiAbility>(createMongoAbility);

  for (const membership of principal.memberships) {
    const organizationId = membership.organizationId;
    can("access", "Api", { resource: "projects", operation: "read", organizationId });
    can("access", "Api", { resource: "documents", operation: "read", organizationId });

    if (membership.role === "guest") continue;

    can("access", "Api", { resource: "projects", operation: "create", organizationId });
    can("access", "Api", { resource: "projects", operation: "archive", organizationId });
    can("access", "Api", { resource: "documents", operation: "create", organizationId });
    can("access", "Api", { resource: "documents", operation: "publish", organizationId });

    if (membership.role === "owner" || membership.role === "admin") {
      can("access", "Api", { resource: "audit", operation: "read", organizationId });
    }
  }

  return build();
}

function defineDataAbility(principal: Principal): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createPrismaAbility);

  for (const membership of principal.memberships) {
    const organizationId = membership.organizationId;
    const readableProject = readableProjectWhere(principal.id, membership);
    const readableDocument = readableDocumentWhere(principal.id, membership);

    can("read", "Organization", { id: organizationId });
    can("read", "Membership", { organizationId });
    can("read", "Project", readableProject);
    can("read", "Document", readableDocument);

    can("view", "Document", ["title", "status", "classificationRank"], readableDocument);
    can("view", "Document", ["body"], {
      AND: [readableDocument, { classificationRank: { lte: membership.clearance } }],
    });
    can("mask", "Document", ["body"], {
      AND: [readableDocument, { classificationRank: membership.clearance + 1 }],
    });
    can("replace", "Document", ["body"], {
      AND: [readableDocument, { classificationRank: { gt: membership.clearance + 1 } }],
    });

    if (membership.role === "guest") {
      can("replace", "Document", ["authorEmail"], readableDocument);
    } else {
      can("view", "Document", ["authorEmail"], readableDocument);
    }

    if (membership.role === "owner") {
      can("manage", "Membership", { organizationId });
    }

    if (membership.role === "owner" || membership.role === "admin") {
      can("create", "Project", { organizationId, ownerId: principal.id });
      can("update", "Project", { organizationId, status: { not: "archived" } });
      can("archive", "Project", { organizationId, status: { not: "archived" } });
      can("create", "Document", {
        authorId: principal.id,
        status: "draft",
        classificationRank: { lte: membership.clearance },
        project: { is: { ...readableProject, status: { not: "archived" } } },
      });
      can("update", "Document", draftDocumentWhere(membership));
      can("publish", "Document", draftDocumentWhere(membership));
    } else if (membership.role === "member") {
      can("create", "Project", {
        organizationId,
        ownerId: principal.id,
        department: membership.department,
      });
      can("update", "Project", {
        organizationId,
        ownerId: principal.id,
        status: { not: "archived" },
      });
      can("archive", "Project", {
        organizationId,
        ownerId: principal.id,
        status: { not: "archived" },
      });
      can("create", "Document", {
        authorId: principal.id,
        status: "draft",
        classificationRank: { lte: membership.clearance },
        project: { is: { ...readableProject, status: { not: "archived" } } },
      });
      can("update", "Document", {
        ...draftDocumentWhere(membership),
        authorId: principal.id,
      });
      can("publish", "Document", {
        ...draftDocumentWhere(membership),
        authorId: principal.id,
      });
    }
  }

  return build();
}

function readableProjectWhere(
  userId: string,
  membership: MembershipAttributes,
): Prisma.ProjectWhereInput {
  if (membership.role === "owner" || membership.role === "admin") {
    return { organizationId: membership.organizationId };
  }

  const visibleToMember: Prisma.ProjectWhereInput = {
    OR: [
      { visibility: "organization" },
      { visibility: "department", department: membership.department },
      { ownerId: userId },
    ],
  };

  if (membership.role === "guest") {
    return {
      organizationId: membership.organizationId,
      AND: [visibleToMember, { OR: [{ status: { not: "draft" } }, { ownerId: userId }] }],
    };
  }

  return {
    organizationId: membership.organizationId,
    ...visibleToMember,
  };
}

function readableDocumentWhere(
  userId: string,
  membership: MembershipAttributes,
): Prisma.DocumentWhereInput {
  const inVisibleProject: Prisma.DocumentWhereInput = {
    project: { is: readableProjectWhere(userId, membership) },
  };

  if (membership.role === "owner" || membership.role === "admin") {
    return inVisibleProject;
  }

  return {
    AND: [inVisibleProject, { OR: [{ status: "published" }, { authorId: userId }] }],
  };
}

function draftDocumentWhere(membership: MembershipAttributes): Prisma.DocumentWhereInput {
  return {
    classificationRank: { lte: membership.clearance },
    status: "draft",
    project: {
      is: {
        organizationId: membership.organizationId,
        status: { not: "archived" },
      },
    },
  };
}
