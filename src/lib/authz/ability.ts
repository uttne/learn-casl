import { AbilityBuilder, subject } from "@casl/ability";
import { createPrismaAbility, type AppAbility } from "@/lib/authz/casl";
import { defineApiAbility, type ApiAbility, type ApiSubject } from "@/lib/authz/api-access";
import { grantFieldAccess } from "@/lib/authz/fields";
import type { Principal } from "@/lib/authz/principal";
import { grantRowAccess } from "@/lib/authz/rows";

export { subject };
export type { AppAbility, ApiAbility, ApiSubject };

/**
 * 一人のリクエストで使う二つの判定器です。
 *
 * 読む順:
 * 1. principal.ts  誰か。ロール、部門、クリアランス
 * 2. contract.ts   プランにその機能があるか。無ければ画面は非表示、API は 404
 * 3. api-access.ts その組織でその API を呼んでよいか。だめなら画面は無効、API は 403
 * 4. rows.ts       どの行を WHERE で残すか
 * 5. fields.ts     残った行の本文とメールを、表示、マスク、置換のどれにするか
 * 6. gate.ts       ルートが 2 のあと 3 を実行する入口
 *
 * data は行と項目、api は API の入口です。契約はどちらにも入れません。
 * 所属が複数あるときは所属ごとに can を足します。合成は OR です。
 * cannot は使いません。一つの所属の拒否が、別の所属の許可まで消えるためです。
 */
export type Access = {
  data: AppAbility;
  api: ApiAbility;
};

export function defineAbilityFor(principal: Principal): Access {
  return {
    data: defineDataAbility(principal),
    api: defineApiAbility(principal),
  };
}

function defineDataAbility(principal: Principal): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createPrismaAbility);

  for (const membership of principal.memberships) {
    grantRowAccess(can, principal.id, membership);
    grantFieldAccess(can, principal.id, membership);
  }

  return build();
}
