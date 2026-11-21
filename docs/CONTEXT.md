# エージェント向けコンテキスト

Scylla は、契約、API 操作、行、項目を分けて認可する学習用アプリです。関数の流れは [calls.md](./calls.md)、接続は [architecture.md](./architecture.md)、ルールは [authorization.md](./authorization.md) です。実装を変えたら、この 3 つと本ファイルをコードに合わせて更新します。

## 不変条件

- 行のポリシーは `src/lib/authz/rows.ts` の `grantRowAccess` にだけ書く。項目は `src/lib/authz/fields.ts` の `grantFieldAccess` にだけ書く。API 操作は `src/lib/authz/api-access.ts` の `defineApiAbility` にだけ書く。プランの機能一覧は `src/lib/authz/contract.ts` にだけ書く。`ability.ts` の `defineAbilityFor` はこれらを組み立てるだけで、条件を持たない。
- 画面、Route Handler、DAL に条件を複製しない。Route Handler はゲート、`whereCan`、`data.can`、`presentDocument` を呼ぶ。
- Ability の入力は `Principal`（ユーザー ID と所属のロール、部門、クリアランス）だけにする。プランは組織の属性としてゲートが見る。
- 制限は許可条件に書く。`cannot` は所属をまたいで効くため、複数組織の OR と一緒に使わない。
- 契約を先に判定する。契約が無ければ 404、`layer: "contract"`。契約があり API Ability が拒否すれば 403、`layer: "resource"`。行や候補の拒否は 403、`layer: "attribute"`。
- 画面の `hidden` は契約の外、`disabled` は契約内の API 拒否、または機能は有効でもその行を `data` Ability が拒否した状態である。
- アプリから CASL Prisma を import するときは `@/lib/authz/casl` を使う。Prisma 7 の生成先は `src/generated/prisma` で、`@casl/prisma/runtime` をそこで包んでいる。`api` Ability は `createMongoAbility` を使う。
- 共有の `prisma` には `createCaslExtension()` を付けたままにする。ルールが無いクエリは 0 件になる。seed 用の別クライアントは対象外。
- 一覧と更新の行条件は `whereCan`（`accessibleBy(...).ofType(...)`）を通す。更新は `updateMany` とし、ゲートを通過した組織 ID と合わせ、件数が 1 のときだけ成功にする。
- 作成は、ルールが読むフィールドをすべて載せた候補に `subject(モデル名, 候補)` を付け、`data.can` で判定してから `create` する。文書なら親 `project` を含める。
- 本文と著者メールは、行を返したあと `presentDocument` で変換する。等級で文書の行を落とさない。
- オブジェクトのサブジェクト名はサーバーが決める。クライアント入力をモデル名にしない。
- 画面は `/api` を呼ぶ。データを Server Component から Prisma で引かない。操作の見本は `src/sample`、対応表は `src/guide/comparison.tsx` で、`Workspace` が左右に並べる。
- `GET /api/catalog` は比較表のために全件を読む。操作の認可は projects、documents、audit の Route が行う。
- サンプルの書き込みが付ける `x-scylla-sample: preview` は、認可が成功したあとで行を戻すためだけに使う。ゲートより前では見ない。
- `scylla_user` クッキーはデモ用の平文ユーザー ID である。本番の認証に見せて強化しない。認証を足すなら、検証済み ID を `getSession` に渡すところまでで止める。

## ローカルで確認する手順

`mise` が入っていること。データベースは Docker Compose です。コマンドは README と同じく `mise exec` 経由です。

```bash
mise install
mise exec -- pnpm install
mise exec -- pnpm db:setup
mise exec -- pnpm test
mise exec -- pnpm dev
```

アプリはポート 3000 です。`pnpm db:setup` はコンテナの起動、マイグレーション、seed を続けて実行します。seed は毎回作り直します。`src/lib/dal.db.test.ts` は seed 済みの Acme / Nimbus を仮定し、更新テストのあと行を元に戻します。

## 触るときの地図

| 変えたいこと | 先に見るファイル |
| --- | --- |
| 誰がどの API を呼べるか | `src/lib/authz/api-access.ts`、`src/lib/authz/gate.ts` |
| 誰がどの行を扱えるか | `src/lib/authz/rows.ts`、`src/lib/authz/ability.test.ts` |
| プランと機能の状態 | `src/lib/authz/contract.ts`、`src/lib/authz/gate.ts`、`src/lib/authz/gate.test.ts` |
| 本文とメールの変換 | `src/lib/authz/fields.ts` |
| 一覧に出る行 | `src/lib/dal.ts`、`src/lib/dal.db.test.ts` |
| HTTP の段とステータス | `src/app/api/**`、`src/lib/api.ts` |
| 呼び出しの図 | `docs/calls.md`、`docs/diagrams/call-map.svg` |
| 人物と初期データ | `prisma/seed.ts`、`docs/authorization.md` |
| セッションの形 | `src/lib/session.ts` |
| 画面 | `src/app/workspace.tsx`、`src/sample`、`src/guide/comparison.tsx` |
| テーブル定義 | `prisma/schema.prisma`、`docs/database.md` |
| クライアント生成と拡張 | `prisma/schema.prisma`、`src/lib/prisma.ts`、`src/lib/authz/casl.ts` |

Next.js 16 の API は、このリポジトリの `AGENTS.md` が指す `node_modules/next/dist/docs/` を見てください。
