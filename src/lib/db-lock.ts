import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

function hash32(value: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash | 0;
}

async function acquire(tx: Tx, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${hash32(key, 0x811c9dc5)}, ${hash32(key, 0x9e3779b9)})`;
}

export function lockOrderSequence(tx: Tx, restaurantId: string) {
  return acquire(tx, `order-sequence:${restaurantId}`);
}

export function lockTableCart(tx: Tx, tableSessionId: string) {
  return acquire(tx, `table-cart:${tableSessionId}`);
}
