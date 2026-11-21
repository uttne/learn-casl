export const membershipRoles = ["owner", "admin", "member", "guest"] as const;

export type MembershipRole = (typeof membershipRoles)[number];

export const projectVisibilities = ["private", "department", "organization"] as const;

export type ProjectVisibility = (typeof projectVisibilities)[number];

export const projectStatuses = ["draft", "active", "archived"] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export const documentStatuses = ["draft", "published"] as const;

export type DocumentStatus = (typeof documentStatuses)[number];

export const clearanceLevels = [1, 2, 3] as const;

export type Clearance = (typeof clearanceLevels)[number];

/** 一つの組織の中での属性。同じ人でも組織が違えばロールもクリアランスも違います。 */
export type MembershipAttributes = {
  organizationId: string;
  role: MembershipRole;
  department: string;
  clearance: number;
};

/**
 * 認可が見てよい本人情報。メールや表示名は入れません。
 * プランも入れません。契約は組織の属性として gate.ts が別に見ます。
 */
export type Principal = {
  id: string;
  memberships: MembershipAttributes[];
};
