import { subject, type AppAbility } from "@/lib/authz/ability";
import type { DocumentStatus, ProjectStatus, ProjectVisibility } from "@/lib/authz/principal";

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
