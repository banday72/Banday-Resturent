import { handleRoute, ok } from "@/lib/api";
import { getBillByToken } from "@/services/billing";

export const GET = (_request: Request, { params }: { params: Promise<{ token: string }> }) =>
  handleRoute(async () => {
    const { token } = await params;
    const bill = await getBillByToken(token);
    return ok({
      token: bill.token,
      status: bill.status,
      totalCents: bill.totalCents,
      paidCents: bill.paidCents,
      tipCents: bill.tipCents,
      restaurant: bill.tableSession.restaurant,
      branch: bill.tableSession.branch,
      table: bill.tableSession.table,
      orders: bill.tableSession.orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalCents: order.totalCents,
        createdAt: order.createdAt,
        items: order.items.map((item) => ({
          id: item.id,
          name: item.name,
          variationName: item.variationName,
          quantity: item.quantity,
          totalCents: item.totalCents,
          instructions: item.instructions,
        })),
      })),
      splits: bill.splits,
      payments: bill.payments.map((payment) => ({
        id: payment.id,
        amountCents: payment.amountCents,
        method: payment.method,
        status: payment.status,
        createdAt: payment.createdAt,
      })),
    });
  });
