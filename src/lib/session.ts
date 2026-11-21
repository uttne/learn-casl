import { cookies } from "next/headers";
import { defineAbilityFor, type Access } from "@/lib/authz/ability";
import type { OrganizationPlan } from "@/lib/authz/contract";
import type { MembershipRole, Principal } from "@/lib/authz/principal";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "scylla_user";

export type SessionOrganization = {
  id: string;
  name: string;
  plan: OrganizationPlan;
  role: MembershipRole;
  department: string;
  clearance: number;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  description: string;
  organizations: SessionOrganization[];
};

export type Session = {
  user: SessionUser;
  access: Access;
};

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const userId = jar.get(SESSION_COOKIE)?.value;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { include: { organization: true } } },
  });
  if (!user) return null;

  const principal: Principal = {
    id: user.id,
    memberships: user.memberships.map((membership) => ({
      organizationId: membership.organizationId,
      role: membership.role,
      department: membership.department,
      clearance: membership.clearance,
    })),
  };

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      description: user.description,
      organizations: user.memberships.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        plan: membership.organization.plan,
        role: membership.role,
        department: membership.department,
        clearance: membership.clearance,
      })),
    },
    access: defineAbilityFor(principal),
  };
}
