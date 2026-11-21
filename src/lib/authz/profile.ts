import { defineAbilityFor } from "@/lib/authz/ability";
import { explainDataAccess } from "@/lib/authz/explain";
import { featureMap } from "@/lib/authz/gate";
import type { Feature, FeatureState, OrganizationPlan } from "@/lib/authz/contract";
import type { MembershipRole } from "@/lib/authz/principal";

export type PersonaOrganization = {
  id: string;
  name: string;
  plan: OrganizationPlan;
  role: MembershipRole;
  department: string;
  clearance: number;
  features: Record<Feature, FeatureState>;
  dataNotes: string[];
};

export type PersonaProfile = {
  id: string;
  email: string;
  name: string;
  description: string;
  organizations: PersonaOrganization[];
};

type MembershipSource = {
  role: MembershipRole;
  department: string;
  clearance: number;
  organization: { id: string; name: string; plan: OrganizationPlan };
};

export function toPersonaProfile(user: {
  id: string;
  email: string;
  name: string;
  description: string;
  memberships: MembershipSource[];
}): PersonaProfile {
  const organizations = user.memberships.map((membership) => ({
    id: membership.organization.id,
    name: membership.organization.name,
    plan: membership.organization.plan,
    role: membership.role,
    department: membership.department,
    clearance: membership.clearance,
  }));
  const access = defineAbilityFor({
    id: user.id,
    memberships: organizations.map((organization) => ({
      organizationId: organization.id,
      role: organization.role,
      department: organization.department,
      clearance: organization.clearance,
    })),
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    description: user.description,
    organizations: organizations.map((organization) => {
      const features = featureMap({ api: access.api, organizations }, organization.id);
      return {
        ...organization,
        features,
        dataNotes: explainDataAccess(organization, features),
      };
    }),
  };
}
