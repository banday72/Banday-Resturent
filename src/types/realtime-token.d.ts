declare module "../../realtime-token.mjs" {
  export type RealtimePayload = {
    scope: "staff" | "guest";
    restaurantId: string;
    branchId?: string | null;
    userId?: string | null;
    guestId?: string | null;
    tableSessionId?: string | null;
    exp?: number;
  };
  export function signRealtimeToken(payload: Omit<RealtimePayload, "exp">): string;
  export function verifyRealtimeToken(token: string): RealtimePayload | null;
}
