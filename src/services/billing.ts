import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/session";
import { publicToken } from "@/lib/utils";
import { emitToRestaurant, emitToTableSession } from "@/lib/realtime";

type Tx = Prisma.TransactionClient;

export async function recalculateBill(tx: Tx, tableSessionId: string) {
  const session = await tx.tableSession.findUnique({
    where: { id: tableSessionId },
    include: { table: true, bill: true },
  });
  if (!session) throw new HttpError(404, "Table session not found");

  const aggregate = await tx.order.aggregate({
    where: { tableSessionId, status: { not: "CANCELLED" } },
    _sum: { totalCents: true },
  });
  const totalCents = aggregate._sum.totalCents ?? 0;
  const existing = session.bill;
  const paidCents = existing?.paidCents ?? 0;
  const fullyPaid = totalCents > 0 && paidCents >= totalCents + (existing?.tipCents ?? 0);

  const bill = existing
    ? await tx.bill.update({
        where: { id: existing.id },
        data: {
          totalCents,
          status: fullyPaid ? "PAID" : paidCents > 0 ? "PARTIALLY_PAID" : existing.status === "REQUESTED" ? "REQUESTED" : "OPEN",
          completedAt: fullyPaid ? (existing.completedAt ?? new Date()) : null,
        },
      })
    : await tx.bill.create({
        data: {
          restaurantId: session.restaurantId,
          branchId: session.branchId,
          tableSessionId,
          token: publicToken(),
          totalCents,
        },
      });

  if (fullyPaid) {
    await tx.tableSession.update({ where: { id: tableSessionId }, data: { status: "PAID", closedAt: new Date() } });
    await tx.restaurantTable.update({
      where: { id: session.tableId },
      data: { status: "FULLY_PAID", activeSessionId: null },
    });
  } else if (paidCents > 0) {
    await tx.tableSession.update({ where: { id: tableSessionId }, data: { status: "PARTIALLY_PAID" } });
    await tx.restaurantTable.update({ where: { id: session.tableId }, data: { status: "PARTIALLY_PAID" } });
  }

  return bill;
}

export async function requestBill(tableSessionId: string, guestId?: string) {
  const result = await prisma.$transaction(async (tx) => {
    const bill = await recalculateBill(tx, tableSessionId);
    if (bill.totalCents === 0) throw new HttpError(400, "There is no bill to request yet");
    const updated = await tx.bill.update({
      where: { id: bill.id },
      data: {
        status: bill.paidCents >= bill.totalCents ? "PAID" : "REQUESTED",
        requestedById: guestId ?? bill.requestedById,
        requestedAt: bill.requestedAt ?? new Date(),
      },
    });
    const session = await tx.tableSession.findUniqueOrThrow({ where: { id: tableSessionId } });
    await tx.tableSession.update({ where: { id: tableSessionId }, data: { status: "BILL_REQUESTED" } });
    if (bill.paidCents === 0) {
      await tx.restaurantTable.update({ where: { id: session.tableId }, data: { status: "BILL_REQUESTED" } });
    }
    await tx.notification.create({
      data: {
        restaurantId: session.restaurantId,
        type: "BILL_REQUESTED",
        title: "Bill requested",
        message: `Table ${await tx.restaurantTable.findUniqueOrThrow({ where: { id: session.tableId } }).then((table) => table.number)} requested the bill.`,
        data: { tableSessionId, billId: bill.id },
      },
    });
    return { bill: updated, tableSessionId, restaurantId: session.restaurantId };
  });
  emitToRestaurant(result.restaurantId, "bill:updated", result.bill);
  emitToTableSession(tableSessionId, "bill:updated", result.bill);
  return result.bill;
}

export type SplitInput = {
  type: "FULL" | "EQUAL" | "ITEMS" | "CUSTOM";
  label?: string;
  guestSessionId?: string | null;
  allocations?: Array<{ label: string; amountCents: number; guestSessionId?: string | null }>;
};

export async function configureSplit(billToken: string, input: SplitInput) {
  const bill = await prisma.bill.findUnique({ where: { token: billToken } });
  if (!bill) throw new HttpError(404, "Bill not found");
  const paymentCount = await prisma.payment.count({ where: { billId: bill.id, status: "SUCCEEDED" } });
  if (paymentCount > 0) throw new HttpError(409, "Splits cannot be changed after payments are recorded");

  const allocations = input.allocations ?? [];
  let splits: Array<{ label: string; amountCents: number; guestSessionId: string | null }> = [];

  if (input.type === "FULL") {
    splits = [{ label: input.label || "Table bill", amountCents: bill.totalCents + bill.tipCents, guestSessionId: input.guestSessionId ?? null }];
  } else if (input.type === "EQUAL") {
    const count = Math.max(allocations.length, 2);
    const base = Math.floor((bill.totalCents + bill.tipCents) / count);
    const remainder = bill.totalCents + bill.tipCents - base * count;
    splits = Array.from({ length: count }, (_, index) => ({
      label: allocations[index]?.label || `Guest ${index + 1}`,
      amountCents: base + (index === 0 ? remainder : 0),
      guestSessionId: allocations[index]?.guestSessionId ?? null,
    }));
  } else {
    splits = allocations
      .filter((allocation) => allocation.amountCents > 0)
      .map((allocation) => ({
        label: allocation.label,
        amountCents: Math.round(allocation.amountCents),
        guestSessionId: allocation.guestSessionId ?? null,
      }));
    const assigned = splits.reduce((sum, split) => sum + split.amountCents, 0);
    if (assigned > bill.totalCents + bill.tipCents) throw new HttpError(400, "Split amounts exceed the bill total");
    if (assigned < bill.totalCents + bill.tipCents) {
      splits.push({
        label: "Remaining balance",
        amountCents: bill.totalCents + bill.tipCents - assigned,
        guestSessionId: null,
      });
    }
  }

  if (splits.length === 0) throw new HttpError(400, "At least one split is required");

  const created = await prisma.$transaction(async (tx) => {
    await tx.paymentSplit.deleteMany({ where: { billId: bill.id } });
    const records = [];
    for (const split of splits) {
      records.push(
        await tx.paymentSplit.create({
          data: {
            billId: bill.id,
            restaurantId: bill.restaurantId,
            guestSessionId: split.guestSessionId,
            label: split.label,
            type: input.type,
            assignedCents: split.amountCents,
          },
        }),
      );
    }
    return records;
  });
  emitToTableSession(bill.tableSessionId, "bill:splits", created);
  return created;
}

export type RecordPaymentInput = {
  billToken: string;
  amountCents: number;
  method: "CASH" | "ONLINE";
  splitId?: string | null;
  guestSessionId?: string | null;
  idempotencyKey: string;
  provider?: string;
  providerRef?: string | null;
  recordedByUserId?: string | null;
  allowTip?: boolean;
};

export async function recordPayment(input: RecordPaymentInput) {
  const existing = await prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return { payment: existing, bill: await prisma.bill.findUniqueOrThrow({ where: { id: existing.billId } }) };

  if (input.amountCents <= 0) throw new HttpError(400, "Payment amount must be positive");

  const result = await prisma.$transaction(async (tx) => {
    const bill = await prisma.bill.findUnique({
      where: { token: input.billToken },
      include: { tableSession: { include: { table: true } } },
    });
    if (!bill) throw new HttpError(404, "Bill not found");
    const split = input.splitId
      ? await tx.paymentSplit.findFirst({ where: { id: input.splitId, billId: bill.id } })
      : null;
    if (input.splitId && !split) throw new HttpError(400, "Split does not belong to this bill");

    const outstandingCents = bill.totalCents + bill.tipCents - bill.paidCents;
    if (outstandingCents <= 0) throw new HttpError(409, "This bill is already paid in full");
    if (input.amountCents > outstandingCents) throw new HttpError(400, "Payment exceeds the outstanding balance");

    let tipCents = 0;
    if (split) {
      const splitRemaining = split.assignedCents - split.paidCents;
      if (input.amountCents > splitRemaining) {
        if (!input.allowTip || input.amountCents > splitRemaining + (outstandingCents - splitRemaining)) {
          throw new HttpError(400, "Payment exceeds this split's remaining balance");
        }
        tipCents = input.amountCents - splitRemaining;
      }
    }

    const payment = await tx.payment.create({
      data: {
        restaurantId: bill.restaurantId,
        branchId: bill.branchId,
        billId: bill.id,
        splitId: split?.id ?? null,
        guestSessionId: input.guestSessionId ?? split?.guestSessionId ?? null,
        amountCents: input.amountCents,
        method: input.method,
        provider: input.provider ?? (input.method === "CASH" ? "cash" : "mock"),
        providerRef: input.providerRef ?? null,
        status: "SUCCEEDED",
        idempotencyKey: input.idempotencyKey,
        recordedByUserId: input.recordedByUserId ?? null,
        metadata: { tipCents },
      },
    });

    if (split) {
      const paidCents = split.paidCents + input.amountCents - tipCents;
      await tx.paymentSplit.update({
        where: { id: split.id },
        data: {
          paidCents,
          status: paidCents >= split.assignedCents ? "SUCCEEDED" : "PENDING",
        },
      });
    }

    const paidCents = bill.paidCents + input.amountCents;
    const fullyPaid = paidCents >= bill.totalCents + bill.tipCents + tipCents;
    const updatedBill = await tx.bill.update({
      where: { id: bill.id },
      data: {
        paidCents,
        tipCents: bill.tipCents + tipCents,
        status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
        completedAt: fullyPaid ? new Date() : null,
      },
    });

    await tx.tableSession.update({
      where: { id: bill.tableSessionId },
      data: fullyPaid ? { status: "PAID", closedAt: new Date() } : { status: "PARTIALLY_PAID" },
    });
    if (fullyPaid) {
      await tx.restaurantTable.update({
        where: { id: bill.tableSession.tableId },
        data: { status: "FULLY_PAID", activeSessionId: null },
      });
    } else {
      await tx.restaurantTable.update({
        where: { id: bill.tableSession.tableId },
        data: { status: "PARTIALLY_PAID" },
      });
    }

    await tx.auditLog.create({
      data: {
        restaurantId: bill.restaurantId,
        userId: input.recordedByUserId ?? null,
        action: "PAYMENT_RECORDED",
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          billId: bill.id,
          amountCents: input.amountCents,
          method: input.method,
          splitId: split?.id ?? null,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    await tx.notification.create({
      data: {
        restaurantId: bill.restaurantId,
        type: "PAYMENT_COMPLETED",
        title: "Payment received",
        message: `${input.amountCents / 100} received for table ${bill.tableSession.table.number}.`,
        data: { billId: bill.id, paymentId: payment.id, tableSessionId: bill.tableSessionId },
      },
    });
    return { payment, bill: updatedBill, restaurantId: bill.restaurantId, tableSessionId: bill.tableSessionId };
  });

  emitToRestaurant(result.restaurantId, "bill:updated", result.bill);
  emitToTableSession(result.tableSessionId, "payment:completed", result.payment);
  return { payment: result.payment, bill: result.bill };
}

export async function getBillByToken(token: string) {
  const bill = await prisma.bill.findUnique({
    where: { token },
    include: {
      tableSession: {
        include: {
          table: true,
          branch: true,
          restaurant: { include: { settings: true } },
          orders: { orderBy: { createdAt: "asc" }, include: { items: true } },
        },
      },
      splits: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!bill) throw new HttpError(404, "Bill not found");
  return bill;
}
