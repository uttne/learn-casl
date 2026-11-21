# 認可ルール

どの関数がどの順でこれらのルールを見るかは [関数の呼び出し](./calls.md) です。

`defineAbilityFor` は `src/lib/authz/ability.ts` にあります。中身は層ごとのファイルです。契約は `contract.ts`、API の入口は `api-access.ts`、行は `rows.ts`、項目は `fields.ts`、ルートが最初に呼ぶ確認は `gate.ts` です。所属が複数あるときは、所属ごとに許可を足します。合成は OR です。

等級は数です。1 が公開、2 が社内、3 が機密です。クリアランスはユーザーではなく所属の属性です。行を一覧から落とす条件には使わず、本文の表示、マスク、置換と、作成、公開の可否に使います。

## 契約

| プラン | 含まれる機能 |
| --- | --- |
| Starter | プロジェクトの参照、文書の参照 |
| Business | Starter に加え、プロジェクトの作成とアーカイブ、文書の作成と公開 |
| Enterprise | Business に加え、監査 |

seed の Acme は Enterprise、Nimbus は Starter です。Business の組織は入れていません。

## API 操作

`api` Ability は、契約を通過したあとに組織ごとに見ます。

| 操作 | owner / admin | member | guest |
| --- | --- | --- | --- |
| `projects.read`、`documents.read` | 可 | 可 | 可 |
| `projects.create`、`projects.archive`、`documents.create`、`documents.publish` | 可 | 可 | 不可 |
| `audit.read` | 可 | 不可 | 不可 |

ゲストは Enterprise の Acme にいても作成を呼べません。画面では無効です。Starter の Nimbus では、オーナーでも作成と監査は契約の外なので非表示です。監査を呼べるのは、Enterprise 組織のオーナーか管理者だけです。

## プロジェクトの行

| 操作 | owner / admin | member | guest |
| --- | --- | --- | --- |
| read | その組織の全行 | 組織公開、同じ部門の部門公開、自分が所有者、のいずれか | member と同じ見える範囲に加え、他人の `draft` は除外 |
| create | その組織で、所有者は自分 | それに加え、部門が所属部門と一致 | ルールなし |
| update / archive | その組織で、状態が `archived` 以外 | それに加え、所有者が自分 | ルールなし |

メンバーは、公開範囲が合えば他人の下書きプロジェクトも読みます。ゲストは自分の下書き以外を読みません。管理者とオーナーは公開範囲と状態を問わず、その組織のプロジェクトを読みます。

API 操作がゲストに無いため、ゲストの作成とアーカイブは行の条件まで届きません。行のルールもゲストには付与していません。

## 文書の行

読み取りの土台は「親プロジェクトが、その所属から読める」です。等級では行を落としません。関係条件は `project: { is: readableProjectWhere(...) }` です。

| 操作 | owner / admin | member | guest |
| --- | --- | --- | --- |
| read | 読めるプロジェクトの文書。下書きも他人のものも対象 | それに加え、`published` か自分が著者 | member と同じ |
| create | 著者は自分、状態は `draft`、等級はクリアランス以下、親は読めていてアーカイブされていない | 同じ | ルールなし |
| update / publish | 下書き、等級はクリアランス以下、親はその組織にありアーカイブされていない | それに加え、著者が自分 | ルールなし |

管理者は部門を越えられます。公開と更新の行条件は、読み取り用の公開範囲までは見ていません。見ているのは組織と、アーカイブされていないことと、等級がクリアランス以下であることです。メンバーの公開は著者本人に限られます。

## 項目

読める文書について、項目ごとに `view`、`mask`、`replace` を付けます。`presentDocument` は `view` なら値をそのまま、`mask` ならマスク、それ以外は置換文を返します。

| 項目 | 条件 | 返る値 |
| --- | --- | --- |
| `title`、`status`、`classificationRank` | 行が読める | そのまま。`view` |
| `body` | 等級がクリアランス以下 | 本文。`visible` |
| `body` | 等級がクリアランス + 1 | `••••••••`。`masked` |
| `body` | 等級がクリアランス + 1 より上 | `この等級の本文は表示できません`。`replaced` |
| `authorEmail` | owner、admin、member | 著者のメール。`visible` |
| `authorEmail` | guest | `非公開`。`replaced` |

Dana（クリアランス 1）の Platform API では、Public overview（等級 1）が表示、Runbook（等級 2）がマスク、Confidential keys（等級 3）が置換です。行自体は 3 件とも返ります。Chloe と Ben（クリアランス 2）は等級 3 をマスクします。Aoi の Acme（クリアランス 3）は機密の本文も表示し、Nimbus のゲスト（クリアランス 1）は Confidential results を置換し、著者メールも `非公開` にします。

## 組織と所属

どの所属でも、自分の `organizationId` の組織と、その組織の Membership 行を読めます。`manage Membership` を持つのはその組織のオーナーだけです。Nimbus のゲストである Aoi は、Acme の所属は管理でき、Nimbus の所属は管理できません。この操作の API はありません。

## シードの人物

| 人物 | 所属 | 属性 |
| --- | --- | --- |
| Aoi Sato | Acme owner、Nimbus guest | Acme は engineering / クリアランス 3。Nimbus は research / クリアランス 1 |
| Ben Ito | Acme admin | engineering / クリアランス 2 |
| Chloe Kim | Acme member | engineering / クリアランス 2。Platform API の所有者 |
| Dana Mori | Acme member | sales / クリアランス 1。Sales pipeline の所有者 |
| Evan Berg | Acme guest | engineering / クリアランス 2 |
| Faye Okada | Nimbus owner | research / クリアランス 3。Vaccine study の所有者 |

Acme（Enterprise）のプロジェクト:

| プロジェクト | 部門 | 公開範囲 | 状態 | 所有者 | 文書 |
| --- | --- | --- | --- | --- | --- |
| Platform API | engineering | organization | active | Chloe | Public overview（1, 公開済み）、Runbook（2, 公開済み）、Internal design（2, 下書き, Chloe）、Confidential keys（3, 公開済み, Aoi） |
| Sales pipeline | sales | department | active | Dana | Q4 forecast（1, 公開済み） |
| Ben draft | engineering | private | draft | Ben | Scratch note（1, 下書き, Ben） |

Nimbus（Starter）のプロジェクト:

| プロジェクト | 部門 | 公開範囲 | 状態 | 所有者 | 文書 |
| --- | --- | --- | --- | --- | --- |
| Vaccine study | research | organization | active | Faye | Public abstract（1, 公開済み）、Confidential results（3, 公開済み） |

## 人物ごとに残る行

`src/lib/dal.db.test.ts` が、seed 後の一覧を次のように固定しています。等級の高い文書も、行が読めるならタイトルは残ります。本文の変換は別のテストが Dana について固定しています。

| 人物 | 残る行 |
| --- | --- |
| Chloe | Platform API の 4 文書。営業の部門公開、Ben の private 下書き、Nimbus は無い |
| Dana | Platform API の公開済み 3 文書と、Sales pipeline。他人の下書き Internal design は無い。Nimbus は無い |
| Evan | Platform API の公開済み 3 文書。他人の下書き、Ben draft、営業プロジェクトは無い |
| Ben | Acme の 3 プロジェクトと、Platform API の 4 文書。Chloe の下書きを公開できる |
| Aoi | Acme は全部。Nimbus の Vaccine study も両方の文書が残る。Nimbus のプロジェクトは更新できない |
| Faye | Vaccine study の両方。Acme は所属が無いので無い |
| 所属なし | プロジェクト 0 件。`can("read", "Project")` も偽 |

ゲストのアーカイブ、Chloe のアーカイブ、Dana の公開、Ben の公開は、同じテストが `updateMany` の件数で確認します。変更した行は `finally` で seed の状態に戻します。Vitest は `fileParallelism: false` で、この共有データベースを並行に書き換えないようにしています。

`src/lib/authz/gate.test.ts` は、Faye の作成が契約の 404、Evan の作成が API 操作の 403、Ben の監査が Enterprise で許可されることを固定しています。

## ルールを足すとき

行の制限は `rows.ts`、項目の制限は `fields.ts` の `can` に足します。`cannot` を足すと、他の所属の許可と干渉します。API 操作を増やすときは `contract.ts` の機能と `api-access.ts` のルールの両方に足し、ゲートは `authorizeFeature` か `authorizeFeatureSomewhere` を通します。条件が関係を見るなら `is` などの演算子を付け、オブジェクト検査ではその関係のフィールドを `subject` に載せます。一覧と更新は `whereCan` を通し、作成は候補オブジェクトの `data.can` を通します。項目を増やすときは `view`、`mask`、`replace` と `presentDocument` を一緒に変えます。
