import { subject } from "@casl/ability";
import type { AppAbility } from "@/lib/authz/casl";
import type { Feature } from "@/lib/authz/contract";
import type { PresentedDocument } from "@/lib/authz/fields";
import { featureMap, type FeatureGate } from "@/lib/authz/gate";

/**
 * 画面のボタンは、契約、API 入口、その行、の順で決まります。
 * 契約に無ければ hidden。契約にあって API か行が拒否なら disabled。全部通れば enabled。
 */
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
