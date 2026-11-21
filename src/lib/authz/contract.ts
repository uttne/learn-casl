/**
 * 契約。画面を出すか、API を 404 にするかを決めます。
 * 誰がその機能を使えるかは api-access.ts です。ここではプランに含まれるかだけを見ます。
 */

export const organizationPlans = ["starter", "business", "enterprise"] as const;

export type OrganizationPlan = (typeof organizationPlans)[number];

export const features = [
  "projects.read",
  "projects.create",
  "projects.archive",
  "documents.read",
  "documents.create",
  "documents.publish",
  "audit.read",
] as const;

export type Feature = (typeof features)[number];

export type ApiResource = "projects" | "documents" | "audit";

export type ApiOperation = "read" | "create" | "publish" | "archive";

export const featureApi = {
  "projects.read": { resource: "projects", operation: "read" },
  "projects.create": { resource: "projects", operation: "create" },
  "projects.archive": { resource: "projects", operation: "archive" },
  "documents.read": { resource: "documents", operation: "read" },
  "documents.create": { resource: "documents", operation: "create" },
  "documents.publish": { resource: "documents", operation: "publish" },
  "audit.read": { resource: "audit", operation: "read" },
} as const satisfies Record<Feature, { resource: ApiResource; operation: ApiOperation }>;

const starterFeatures = ["projects.read", "documents.read"] as const satisfies readonly Feature[];

const businessFeatures = [
  ...starterFeatures,
  "projects.create",
  "projects.archive",
  "documents.create",
  "documents.publish",
] as const satisfies readonly Feature[];

export const planFeatures = {
  starter: starterFeatures,
  business: businessFeatures,
  enterprise: [...businessFeatures, "audit.read"],
} as const satisfies Record<OrganizationPlan, readonly Feature[]>;

export type FeatureState = "hidden" | "disabled" | "enabled";

export function contractIncludes(plan: OrganizationPlan, feature: Feature) {
  return (planFeatures[plan] as readonly Feature[]).includes(feature);
}

/** 契約に無ければ hidden。契約にあって API 入口が拒否なら disabled。両方通れば enabled。 */
export function featureState(contracted: boolean, allowed: boolean): FeatureState {
  if (!contracted) return "hidden";
  if (!allowed) return "disabled";
  return "enabled";
}
