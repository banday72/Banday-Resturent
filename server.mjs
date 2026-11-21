import { createServer } from "node:http";
import next from "next";
import { attachRealtime, handleRealtimeHttp } from "./realtime-service.mjs";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((request, response) => {
  if (handleRealtimeHttp(request, response, io)) return;
  handle(request, response);
});

const io = attachRealtime(server);

server.listen(port, hostname, () => {
  console.log(`Restaurant SaaS running on http://${hostname}:${port}`);
});
