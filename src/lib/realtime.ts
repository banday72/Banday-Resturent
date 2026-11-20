type Emitter = {
  to: (room: string) => { emit: (event: string, payload: unknown) => void };
};

const globalForRealtime = globalThis as unknown as { __io?: Emitter };

const serviceUrl = process.env.REALTIME_SERVICE_URL?.replace(/\/$/, "");
const serviceKey = process.env.REALTIME_SERVICE_KEY;

export function emitToRoom(room: string, event: string, payload: unknown) {
  const io = globalForRealtime.__io;
  if (io) {
    io.to(room).emit(event, payload);
    return;
  }
  if (!serviceUrl || !serviceKey) return;
  void fetch(`${serviceUrl}/_realtime/emit`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-realtime-key": serviceKey },
    body: JSON.stringify({ room, event, payload }),
    cache: "no-store",
  }).catch((error) => {
    if (process.env.NODE_ENV === "development") console.error("[realtime] emit failed", error);
  });
}

export function emitToRestaurant(restaurantId: string, event: string, payload: unknown) {
  emitToRoom(`restaurant:${restaurantId}`, event, payload);
}

export function emitToBranch(branchId: string, event: string, payload: unknown) {
  emitToRoom(`branch:${branchId}`, event, payload);
}

export function emitToGuest(guestId: string, event: string, payload: unknown) {
  emitToRoom(`guest:${guestId}`, event, payload);
}

export function emitToTableSession(tableSessionId: string, event: string, payload: unknown) {
  emitToRoom(`table-session:${tableSessionId}`, event, payload);
}
