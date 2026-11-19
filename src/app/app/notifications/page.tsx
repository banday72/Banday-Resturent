import { getRestaurantForPage } from "@/lib/session";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ restaurant?: string }> }) {
  const { restaurant } = await searchParams;
  const { restaurantId } = await getRestaurantForPage(restaurant);
  const notifications = await prisma.notification.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Notifications" description="Recent activity and alerts for this restaurant." />
      <div className="space-y-3">
        {notifications.length === 0 ? <p className="text-sm text-slate-500">No notifications yet.</p> : notifications.map((n) => (
          <Card key={n.id}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="font-semibold text-slate-900">{n.title}</p>
                <p className="mt-0.5 text-sm text-slate-600">{n.message}</p>
                <p className="mt-1 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              <Badge variant={n.isRead ? "default" : "primary"}>{n.isRead ? "Read" : "New"}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
