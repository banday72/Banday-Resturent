import crypto from "node:crypto";
import { Server } from "socket.io";
import { verifyRealtimeToken } from "./realtime-token.mjs";

const realtimeKey = process.env.REALTIME_SERVICE_KEY || "";

function matchesRealtimeKey(provided) {
  if (!realtimeKey || typeof provided !== "string") return false;
  const actual = crypto.createHash("sha256").update(provided).digest();
  const expected = crypto.createHash("sha256").update(realtimeKey).digest();
  return crypto.timingSafeEqual(actual, expected);
}

function readBody(request, onBody) {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 64 * 1024) request.destroy();
  });
  request.on("end", () => onBody(body));
}

export function handleRealtimeHttp(request, response, io) {
  const pathname = request.url?.split("?")[0];
  if (pathname !== "/_realtime/emit" || request.method !== "POST") return false;

  if (!matchesRealtimeKey(request.headers["x-realtime-key"])) {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Unauthorized" }));
    return true;
  }
  readBody(request, (body) => {
    try {
      const { room, event, payload } = JSON.parse(body);
      if (typeof room !== "string" || typeof event !== "string") throw new Error("Invalid payload");
      io.to(room).emit(event, payload);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
    } catch {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Invalid payload" }));
    }
  });
  return true;
}

export function attachRealtime(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || true,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket, nextMiddleware) => {
    const payload = verifyRealtimeToken(socket.handshake.auth?.token);
    if (!payload) return nextMiddleware(new Error("Unauthorized realtime connection"));
    socket.data.auth = payload;
    nextMiddleware();
  });

  io.on("connection", (socket) => {
    const auth = socket.data.auth;
    socket.join(`restaurant:${auth.restaurantId}`);
    if (auth.branchId) socket.join(`branch:${auth.branchId}`);
    if (auth.userId) socket.join(`user:${auth.userId}`);
    if (auth.guestId) socket.join(`guest:${auth.guestId}`);
    if (auth.tableSessionId) socket.join(`table-session:${auth.tableSessionId}`);
  });

  globalThis.__io = io;
  return io;
}
