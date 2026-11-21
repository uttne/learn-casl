import type { Ability, ForcedSubject, TaggedSubject } from "@casl/ability";
import {
  accessibleBy,
  createPrismaAbility,
  type PrismaQueryOf,
} from "@casl/prisma/runtime";
import type { Prisma } from "@/generated/prisma/client";
import type {
  DocumentStatus,
  MembershipRole,
  ProjectStatus,
  ProjectVisibility,
} from "@/lib/authz/principal";

export { accessibleBy, createPrismaAbility };

export type PrismaQuery<T extends ForcedSubject<string> = ForcedSubject<string>> =
  PrismaQueryOf<Prisma.TypeMap, T>;

/**
 * data Ability のアクションです。
 * read は行を残すか。view / mask / replace は残った行の項目。
 * publish と archive は、その行を更新してよいかです。
 */
export type AppActions =
  | "manage"
  | "create"
  | "read"
  | "view"
  | "mask"
  | "replace"
  | "update"
  | "delete"
  | "publish"
  | "archive";

type Tagged<Name extends string, Fields> = Fields & ForcedSubject<Name>;

export type AppSubjects =
  | "all"
  | Tagged<"Organization", { id: string }>
  | Tagged<
      "Membership",
      { id?: string; organizationId: string; userId?: string; role?: MembershipRole }
    >
  | Tagged<
      "Project",
      {
        id?: string;
        organizationId: string;
        ownerId: string;
        department: string;
        visibility: ProjectVisibility;
        status: ProjectStatus;
        title?: string;
      }
    >
  | Tagged<
      "Document",
      {
        id?: string;
        projectId?: string;
        authorId: string;
        title?: string;
        classificationRank: number;
        status: DocumentStatus;
        authorEmail?: string;
        project?: {
          id?: string;
          organizationId: string;
          ownerId: string;
          department: string;
          visibility: ProjectVisibility;
          status: ProjectStatus;
        };
      }
    >;

export type AppAbility = Ability<[AppActions, AppSubjects], PrismaQuery, TaggedSubject>;
