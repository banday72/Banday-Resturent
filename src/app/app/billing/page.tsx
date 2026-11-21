import { PageHeader } from "@/components/ui/page";
import { BillingPanel, type BillView } from "@/components/billing/billing-panel";
import { prisma } from "@/lib/prisma";
import { getRestaurantForPage } from "@/lib/session";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ restaurant?: string }> }) {
  const { restaurant } = await searchParams;
  const { user, restaurantId } = await getRestaurantForPage(restaurant);
  const canManage = user.isSuperAdmin
    || user.memberships.some((membership) => membership.restaurantId === restaurantId && membership.permissions.includes("bill:manage"));

  const [billRecords, restaurantRecord] = await Promise.all([
    prisma.bill.findMany({
      where: { restaurantId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        tableSession: { include: { table: true, branch: true } },
        splits: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    }),
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { currency: true } }),
  ]);

  const bills: BillView[] = billRecords.map((bill) => ({
    id: bill.id,
    token: bill.token,
    tableNumber: bill.tableSession.table.number,
    branchName: bill.tableSession.branch.name,
    status: bill.status,
    totalCents: bill.totalCents,
    paidCents: bill.paidCents,
    tipCents: bill.tipCents,
    splits: bill.splits.map((split) => ({
      id: split.id,
      label: split.label,
      type: split.type,
      assignedCents: split.assignedCents,
      paidCents: split.paidCents,
      status: split.status,
    })),
    payments: bill.payments.map((payment) => ({
      id: payment.id,
      amountCents: payment.amountCents,
      method: payment.method,
      status: payment.status,
      createdAt: payment.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="space-y-4">
      <PageHeader title="Billing" description="Bills, splits and payments for table sessions." />
      <BillingPanel bills={bills} restaurantId={restaurantId} currency={restaurantRecord?.currency ?? "PKR"} canManage={canManage} />
    </div>
  );
}
