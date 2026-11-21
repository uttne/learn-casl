export const roleLabel = {
  owner: "オーナー",
  admin: "管理者",
  member: "メンバー",
  guest: "ゲスト",
} as const;

export const visibilityLabel = {
  private: "本人のみ",
  department: "部門",
  organization: "組織",
} as const;

export const projectStatusLabel = {
  draft: "下書き",
  active: "進行中",
  archived: "アーカイブ",
} as const;

export const documentStatusLabel = {
  draft: "下書き",
  published: "公開済み",
} as const;

export function classificationLabel(rank: number) {
  if (rank <= 1) return "公開";
  if (rank === 2) return "社内";
  return "機密";
}

export const planLabel = {
  starter: "Starter",
  business: "Business",
  enterprise: "Enterprise",
} as const;

export const featureLabel = {
  "projects.read": "プロジェクトの参照",
  "projects.create": "プロジェクトの作成",
  "projects.archive": "プロジェクトのアーカイブ",
  "documents.read": "文書の参照",
  "documents.create": "文書の作成",
  "documents.publish": "文書の公開",
  "audit.read": "監査",
} as const;

export const featureStateLabel = {
  hidden: "非表示",
  disabled: "無効",
  enabled: "有効",
} as const;

export const fieldAccessLabel = {
  visible: "表示",
  masked: "マスク",
  replaced: "置換",
} as const;
