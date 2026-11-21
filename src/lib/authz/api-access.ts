import { AbilityBuilder, createMongoAbility, type ForcedSubject, type MongoAbility } from "@casl/ability";
import type { ApiOperation, ApiResource } from "@/lib/authz/contract";
import type { Principal } from "@/lib/authz/principal";

/**
 * 第1層。この人は、この組織で、この API を呼んでよいか。
 *
 * 行の中身（所有者、部門、等級）は見ません。見ているのはロールだけです。
 * プランに機能が含まれるかは契約の仕事で、このファイルでは判定しません。
 * ルートは gate.ts で契約を先に見てから、ここの can を呼びます。
 */
export type ApiSubject = {
  resource: ApiResource;
  operation: ApiOperation;
  organizationId: string;
} & ForcedSubject<"Api">;

export type ApiAbility = MongoAbility<["access", "Api" | ApiSubject]>;

export function defineApiAbility(principal: Principal): ApiAbility {
  const { can, build } = new AbilityBuilder<ApiAbility>(createMongoAbility);

  for (const membership of principal.memberships) {
    const organizationId = membership.organizationId;

    // 参照はどのロールでも、その所属の組織に対して許可する。
    can("access", "Api", { resource: "projects", operation: "read", organizationId });
    can("access", "Api", { resource: "documents", operation: "read", organizationId });

    // ゲストは参照だけ。作成や公開のルールを付けない。
    // cannot は使わない。付けると、別組織での許可まで打ち消す。
    if (membership.role === "guest") continue;

    can("access", "Api", { resource: "projects", operation: "create", organizationId });
    can("access", "Api", { resource: "projects", operation: "archive", organizationId });
    can("access", "Api", { resource: "documents", operation: "create", organizationId });
    can("access", "Api", { resource: "documents", operation: "publish", organizationId });

    // 監査はオーナーと管理者だけ。メンバーにはルールが無いので拒否になる。
    if (membership.role === "owner" || membership.role === "admin") {
      can("access", "Api", { resource: "audit", operation: "read", organizationId });
    }
  }

  return build();
}
