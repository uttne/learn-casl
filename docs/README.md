# Scylla のドキュメント

Scylla は、Next.js の Route Handler、Prisma、CASL、PostgreSQL で、画面と API の認可を分ける学習用サンプルです。データは Server Component からではなく `/api` から取得します。関数の流れから読むときは [関数の呼び出し](./calls.md) です。

認可は次の順です。

1. 契約。組織のプランに機能が無ければ、画面では非表示、API では 404 です。
2. API 操作。契約にある機能を、その組織でのロールが呼べるかを CASL の API Ability が決めます。呼べなければ画面は無効、API は 403 です。
3. 行。`accessibleBy` を Prisma の `where` に渡し、組織、部門、公開範囲、所有者、下書きで行を分けます。
4. 項目。行は返したまま、本文と著者メールを表示、マスク、置換します。クリアランスはここで本文に効きます。

| 文書 | 内容 |
| --- | --- |
| [関数の呼び出し](./calls.md) | ボタンから Route、契約、行、項目まで。シーケンス図と全体図 |
| [アーキテクチャ](./architecture.md) | 画面、Route Handler、2 つの Ability、契約ゲートの接続 |
| [認可ルール](./authorization.md) | プラン、API 操作、行、項目。シードの人物で追跡できる |
| [データベース](./database.md) | ER 図、列挙型、テーブルと外部キー |
| [エージェント向けコンテキスト](./CONTEXT.md) | 実装を変えるときに守る条件と、ファイルの役割 |

コード上の仕様は `src/lib/authz/ability.test.ts`、`src/lib/authz/gate.test.ts`、`src/lib/dal.db.test.ts` が持っています。文書とテストが食い違ったら、テストと `defineAbilityFor` を先に見てください。
