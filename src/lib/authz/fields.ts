import { subject, type AbilityBuilder } from "@casl/ability";
import type { AppAbility } from "@/lib/authz/casl";
import type { DocumentStatus, MembershipAttributes, ProjectStatus, ProjectVisibility } from "@/lib/authz/principal";
import { readableDocumentWhere } from "@/lib/authz/rows";

type Allow = AbilityBuilder<AppAbility>["can"];

/**
 * 第3層。行として返る文書の、項目ごとの出し方。
 *
 * read は行を残すかです。項目は view / mask / replace の別アクションにします。
 * 同じ read に混ぜると、accessibleBy("read") の WHERE が項目条件で狭くなります。
 * 等級が足りない文書も行は返し、本文だけを変えます。
 */
export function grantFieldAccess(can: Allow, userId: string, membership: MembershipAttributes) {
  const readableDocument = readableDocumentWhere(userId, membership);

  can("view", "Document", ["title", "status", "classificationRank"], readableDocument);
  can("view", "Document", ["body"], {
    AND: [readableDocument, { classificationRank: { lte: membership.clearance } }],
  });
  // 一つ上の等級だけマスク。それより上は置換。どちらも行は残っている。
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
}

export type FieldAccess = "visible" | "masked" | "replaced";

export const MASKED_BODY = "••••••••";
export const REPLACED_BODY = "この等級の本文は表示できません";
export const REPLACED_EMAIL = "非公開";

export type PresentableDocument = {
  id: string;
  title: string;
  body: string;
  classificationRank: number;
  status: DocumentStatus;
  authorId: string;
  author: { id: string; name: string; email: string };
  project: {
    id: string;
    organizationId: string;
    ownerId: string;
    department: string;
    visibility: ProjectVisibility;
    status: ProjectStatus;
  };
};

export type PresentedDocument = {
  id: string;
  title: string;
  status: DocumentStatus;
  classificationRank: number;
  body: string;
  bodyAccess: FieldAccess;
  author: { id: string; name: string; email: string };
  emailAccess: FieldAccess;
};

function fieldAccess(ability: AppAbility, document: PresentableDocument, field: "body" | "authorEmail"): FieldAccess {
  // Prisma の結果はクラスではない。subject で「これは Document」と CASL に渡す。
  const tagged = subject("Document", {
    id: document.id,
    title: document.title,
    authorId: document.authorId,
    classificationRank: document.classificationRank,
    status: document.status,
    project: document.project,
    authorEmail: document.author.email,
  });

  if (ability.can("view", tagged, field)) return "visible";
  if (ability.can("mask", tagged, field)) return "masked";
  return "replaced";
}

/** 読めた行を、API が返してよい形に変換します。元の本文はここでは外に出しません。 */
export function presentDocument(ability: AppAbility, document: PresentableDocument): PresentedDocument {
  const bodyAccess = fieldAccess(ability, document, "body");
  const emailAccess = fieldAccess(ability, document, "authorEmail");

  return {
    id: document.id,
    title: document.title,
    status: document.status,
    classificationRank: document.classificationRank,
    body: bodyAccess === "visible" ? document.body : bodyAccess === "masked" ? MASKED_BODY : REPLACED_BODY,
    bodyAccess,
    author: {
      id: document.author.id,
      name: document.author.name,
      email: emailAccess === "visible" ? document.author.email : REPLACED_EMAIL,
    },
    emailAccess,
  };
}
