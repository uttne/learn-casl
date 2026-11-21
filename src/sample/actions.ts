import type { Feature, FeatureState } from "@/lib/authz/contract";

/** One control on the sample screen, and the API it calls. */
export const sampleActions = [
  { feature: "projects.read", label: "プロジェクトを取得", call: "GET /api/projects" },
  { feature: "projects.create", label: "プロジェクトを作成", call: "POST /api/projects" },
  { feature: "projects.archive", label: "プロジェクトをアーカイブ", call: "POST /api/projects/:id/archive" },
  { feature: "documents.read", label: "文書を取得", call: "GET /api/projects" },
  { feature: "documents.create", label: "文書を作成", call: "POST /api/documents" },
  { feature: "documents.publish", label: "文書を公開", call: "POST /api/documents/:id/publish" },
  { feature: "audit.read", label: "監査を取得", call: "GET /api/audit" },
] as const satisfies readonly { feature: Feature; label: string; call: string }[];

export type SampleOrganization = {
  id: string;
  name: string;
  department: string;
  features: Record<Feature, FeatureState>;
};

export type SamplePersona = {
  id: string;
  name: string;
  organizations: SampleOrganization[];
};

/** Collapse per-organization results into the single state a screen control uses. */
export function screenFeatureState(persona: SamplePersona, feature: Feature): FeatureState {
  const states = persona.organizations.map((organization) => organization.features[feature]);
  if (states.includes("enabled")) return "enabled";
  if (states.includes("disabled")) return "disabled";
  return "hidden";
}
