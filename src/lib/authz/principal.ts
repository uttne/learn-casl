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

/** Attributes that travel with a user inside one organization. */
export type MembershipAttributes = {
  organizationId: string;
  role: MembershipRole;
  department: string;
  clearance: number;
};

/** The authenticated user, plus the attributes authorization is allowed to see. */
export type Principal = {
  id: string;
  memberships: MembershipAttributes[];
};
