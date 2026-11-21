import { subject, type ApiAbility } from "@/lib/authz/ability";
import {
  contractIncludes,
  featureApi,
  featureState,
  features,
  type Feature,
  type FeatureState,
  type OrganizationPlan,
} from "@/lib/authz/contract";

export type GateOrganization = {
  id: string;
  name: string;
  plan: OrganizationPlan;
};

export type FeatureGate = {
  api: ApiAbility;
  organizations: GateOrganization[];
};

export type GateDenial = {
  ok: false;
  status: 404 | 403;
  layer: "contract" | "resource";
  error: string;
};

export type GateAllow = {
  ok: true;
  organizationIds: string[];
};

export function featureMap(gate: FeatureGate, organizationId: string) {
  const organization = gate.organizations.find((item) => item.id === organizationId);
  const states = {} as Record<Feature, FeatureState>;
  for (const feature of features) {
    states[feature] = organization
      ? featureState(
          contractIncludes(organization.plan, feature),
          gate.api.can("access", subject("Api", { ...featureApi[feature], organizationId })),
        )
      : "hidden";
  }
  return states;
}

export function authorizeFeature(gate: FeatureGate, organizationId: string, feature: Feature): GateAllow | GateDenial {
  const organization = gate.organizations.find((item) => item.id === organizationId);
  if (!organization || !contractIncludes(organization.plan, feature)) {
    return {
      ok: false,
      status: 404,
      layer: "contract",
      error: "この契約ではその機能を利用できません",
    };
  }

  const allowed = gate.api.can("access", subject("Api", { ...featureApi[feature], organizationId }));
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      layer: "resource",
      error: "この API を呼び出す権限がありません",
    };
  }

  return { ok: true, organizationIds: [organizationId] };
}

export function authorizeFeatureSomewhere(gate: FeatureGate, feature: Feature): GateAllow | GateDenial {
  const contracted = gate.organizations.filter((organization) => contractIncludes(organization.plan, feature));
  if (contracted.length === 0) {
    return {
      ok: false,
      status: 404,
      layer: "contract",
      error: "この契約ではその機能を利用できません",
    };
  }

  const organizationIds = contracted
    .filter((organization) =>
      gate.api.can("access", subject("Api", { ...featureApi[feature], organizationId: organization.id })),
    )
    .map((organization) => organization.id);

  if (organizationIds.length === 0) {
    return {
      ok: false,
      status: 403,
      layer: "resource",
      error: "この API を呼び出す権限がありません",
    };
  }

  return { ok: true, organizationIds };
}
