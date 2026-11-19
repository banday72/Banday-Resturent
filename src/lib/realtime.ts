type Emitter = {
  to: (room: string) => { emit: (event: string, payload: unknown) => void };
};

const globalForRealtime = globalThis as unknown as { __io?: Emitter };

export function emitToRoom(room: string, event: string, payload: unknown) {
  globalForRealtime.__io?.to(room).emit(event, payload);
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
