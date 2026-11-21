# Scylla

Next.js の Route Handler、Prisma、CASL、PostgreSQL で、画面と API の認可を分けた学習用サンプルです。データは Server Component からではなく API から取得します。関数がどの順で判定するかは [docs/calls.md](docs/calls.md) です。

## 画面

左が操作するボタン、右が保存データと取得結果の対応表です。ボタンの色は `GET /api/personas` が返す、組織ごとの機能状態です。

- 契約に含まれない機能は `hidden` で、画面に出しません。
- 契約に含まれ、ABAC で拒否される機能は `disabled` で、無効なボタンとして残します。
- 両方を満たす機能は `enabled` です。

Acme は Enterprise です。作成や監査が契約に含まれます。Evan はゲストなので作成は無効、Ben は管理者なので監査は有効です。Nimbus は Starter です。Faye はオーナーでも作成と監査は非表示です。

## API の3段

1. リソース。契約が無ければ 404（`layer: "contract"`）、ABAC で API 操作を拒否するなら 403（`layer: "resource"`）。
2. 行。通った組織に対し、`accessibleBy` を Prisma の `where` に置きます。他組織、他部門、他人の下書きは結果に含まれません。
3. 項目。行は返しますが、本文と著者メールを変えます。クリアランスちょうどの一つ上は `masked`（`••••••••`）、それより上は `replaced`（説明文への置換）です。ゲストの著者メールは `非公開` に置換します。

主なルートは `src/app/api` です。

- `GET /api/personas`、`POST /api/session`、`GET /api/me`
- `GET /api/projects`、`POST /api/projects`、`POST /api/projects/[id]/archive`
- `POST /api/documents`、`POST /api/documents/[id]/publish`
- `GET /api/audit`

## 準備

```sh
mise install
mise exec -- pnpm install
mise exec -- pnpm db:setup
mise exec -- pnpm dev
```

アプリは <http://localhost:3000> です。認可は `src/lib/authz/ability.ts` から読み始めます。契約は `contract.ts`、API の入口は `api-access.ts` と `gate.ts`、行は `rows.ts`、項目の変換は `fields.ts` です。
