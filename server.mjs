import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { verifyRealtimeToken } from "./realtime-token.mjs";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((request, response) => {
  handle(request, response);
});

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

server.listen(port, hostname, () => {
  console.log(`Restaurant SaaS running on http://${hostname}:${port}`);
});
