import type { AbilityBuilder } from "@casl/ability";
import type { Prisma } from "@/generated/prisma/client";
import { accessibleBy, type AppAbility, type AppActions } from "@/lib/authz/casl";
import type { MembershipAttributes } from "@/lib/authz/principal";

type Allow = AbilityBuilder<AppAbility>["can"];

/**
 * 第2層。API を呼べたあと、どの行をデータベースから残すか。
 *
 * 条件は Prisma の where と同じ形です。一覧も更新も whereCan を通します。
 * 等級はここでは使いません。本文を隠すのは fields.ts、作成や公開の上限として使うのは下の更新ルールです。
 * ゲストに作成やアーカイブのルールが無いのは、api-access.ts で既に拒否しているためです。
 */
export function grantRowAccess(can: Allow, userId: string, membership: MembershipAttributes) {
  const organizationId = membership.organizationId;
  const readableProject = readableProjectWhere(userId, membership);
  const readableDocument = readableDocumentWhere(userId, membership);

  can("read", "Organization", { id: organizationId });
  can("read", "Membership", { organizationId });
  can("read", "Project", readableProject);
  can("read", "Document", readableDocument);

  // 所属の管理はオーナーだけ。対応する API はまだ無い。
  if (membership.role === "owner") {
    can("manage", "Membership", { organizationId });
  }

  if (membership.role === "owner" || membership.role === "admin") {
    can("create", "Project", { organizationId, ownerId: userId });
    can("update", "Project", { organizationId, status: { not: "archived" } });
    can("archive", "Project", { organizationId, status: { not: "archived" } });
    can("create", "Document", {
      authorId: userId,
      status: "draft",
      classificationRank: { lte: membership.clearance },
      project: { is: { ...readableProject, status: { not: "archived" } } },
    });
    can("update", "Document", draftDocumentWhere(membership));
    can("publish", "Document", draftDocumentWhere(membership));
    return;
  }

  if (membership.role === "member") {
    // メンバーは自分の部門のプロジェクトだけ作れる。他人の行はアーカイブできない。
    can("create", "Project", { organizationId, ownerId: userId, department: membership.department });
    can("update", "Project", { organizationId, ownerId: userId, status: { not: "archived" } });
    can("archive", "Project", { organizationId, ownerId: userId, status: { not: "archived" } });
    can("create", "Document", {
      authorId: userId,
      status: "draft",
      classificationRank: { lte: membership.clearance },
      project: { is: { ...readableProject, status: { not: "archived" } } },
    });
    can("update", "Document", { ...draftDocumentWhere(membership), authorId: userId });
    can("publish", "Document", { ...draftDocumentWhere(membership), authorId: userId });
  }
}

/** オーナーと管理者はその組織の全プロジェクト。メンバーとゲストは公開範囲で絞る。 */
export function readableProjectWhere(userId: string, membership: MembershipAttributes): Prisma.ProjectWhereInput {
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

  // ゲストは他人の下書きプロジェクトを読まない。自分の下書きは残す。
  if (membership.role === "guest") {
    return {
      organizationId: membership.organizationId,
      AND: [visibleToMember, { OR: [{ status: { not: "draft" } }, { ownerId: userId }] }],
    };
  }

  return { organizationId: membership.organizationId, ...visibleToMember };
}

/** 文書は、まず親プロジェクトが読めること。等級では行を落とさない。 */
export function readableDocumentWhere(userId: string, membership: MembershipAttributes): Prisma.DocumentWhereInput {
  const inVisibleProject: Prisma.DocumentWhereInput = {
    project: { is: readableProjectWhere(userId, membership) },
  };

  if (membership.role === "owner" || membership.role === "admin") return inVisibleProject;

  // メンバーとゲストは、公開済みか、自分の文書だけ。
  return { AND: [inVisibleProject, { OR: [{ status: "published" }, { authorId: userId }] }] };
}

/**
 * 公開と更新の行条件。読み取りの公開範囲は見ない。
 * 見ているのは、下書きであること、等級がクリアランス以下であること、親が同じ組織でアーカイブされていないこと。
 */
export function draftDocumentWhere(membership: MembershipAttributes): Prisma.DocumentWhereInput {
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

type SubjectName = "Organization" | "Membership" | "Project" | "Document";

/**
 * 行ルールを Prisma の where に変換します。
 * ルールが一つも無いとき accessibleBy は空の条件を返します。
 * 空条件を AND の先頭以外に置くと「全部一致」になり得るので、必ず AND の最初に置きます。
 */
export function whereCan<T extends SubjectName>(ability: AppAbility, action: AppActions, subjectType: T) {
  return accessibleBy(ability, action).ofType(subjectType);
}
