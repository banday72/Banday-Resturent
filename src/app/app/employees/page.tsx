import { getRestaurantForPage } from "@/lib/session";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ restaurant?: string }> }) {
  const { restaurant } = await searchParams;
  const { restaurantId } = await getRestaurantForPage(restaurant);
  const memberships = await prisma.restaurantMembership.findMany({
    where: { restaurantId },
    include: { user: { select: { id: true, name: true, email: true } }, role: true, branch: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Staff" description="Team members with access to this restaurant." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {memberships.length === 0 ? <p className="text-sm text-slate-500">No staff members yet.</p> : memberships.map((m) => (
          <Card key={m.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{m.user.name}</p>
                  <p className="text-sm text-slate-500">{m.user.email}</p>
                  {m.branch ? <p className="mt-1 text-xs text-slate-500">Branch: {m.branch.name}</p> : <p className="mt-1 text-xs text-slate-500">All branches</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="primary">{m.role.name}</Badge>
                  <Badge variant={m.isActive ? "success" : "danger"}>{m.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-slate-500">Staff invitations and role editing can be added from the admin workflow; seeded demo accounts are available for testing.</p>
    </div>
  );
}
