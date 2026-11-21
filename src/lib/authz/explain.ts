import type { Feature, FeatureState } from "@/lib/authz/contract";
import type { MembershipRole } from "@/lib/authz/principal";
import { classificationLabel } from "@/lib/labels";

export function explainDataAccess(
  membership: { role: MembershipRole; department: string; clearance: number },
  features: Record<Feature, FeatureState>,
) {
  const notes: string[] = [];

  if (features["projects.read"] !== "enabled") {
    notes.push("プロジェクトは API の入口で止まるので、行は返りません。");
  } else if (membership.role === "owner" || membership.role === "admin") {
    notes.push("この組織のプロジェクトは、公開範囲や部門に関係なく返ります。");
  } else if (membership.role === "guest") {
    notes.push(
      `返るプロジェクトは、組織公開か、${membership.department} の部門公開か、自分が所有者のものです。他人の下書きは除きます。`,
    );
  } else {
    notes.push(
      `返るプロジェクトは、組織公開か、${membership.department} の部門公開か、自分が所有者のものです。`,
    );
  }

  if (features["documents.read"] !== "enabled") {
    notes.push("文書は API の入口で止まるので、行は返りません。");
  } else if (membership.role === "owner" || membership.role === "admin") {
    notes.push("見えるプロジェクトの文書は、下書きも含めて返ります。");
  } else {
    notes.push("見えるプロジェクトの文書は、公開済みか、自分が書いたものだけ返ります。");
  }

  notes.push(
    `本文は等級 ${membership.clearance}（${classificationLabel(membership.clearance)}）以下が表示、一つ上がマスク、それより上が置換です。`,
  );
  notes.push(
    membership.role === "guest"
      ? "著者のメールは「非公開」に置換されます。"
      : "著者のメールはそのまま返ります。",
  );

  return notes;
}
