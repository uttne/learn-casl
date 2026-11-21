import { featureMap } from "@/lib/authz/gate";
import { requireSession } from "@/lib/api";

export async function GET() {
  const result = await requireSession();
  if ("response" in result) return result.response;

  const { session } = result;
  return Response.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      description: session.user.description,
      organizations: session.user.organizations.map((organization) => ({
        ...organization,
        features: featureMap(
          { api: session.access.api, organizations: session.user.organizations },
          organization.id,
        ),
      })),
    },
  });
}
