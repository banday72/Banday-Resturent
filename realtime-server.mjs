import { createServer } from "node:http";
import { attachRealtime, handleRealtimeHttp } from "./realtime-service.mjs";

const port = Number(process.env.PORT || 3001);

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url?.split("?")[0] === "/health") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
    return;
  }
  if (handleRealtimeHttp(request, response, io)) return;
  response.writeHead(404);
  response.end();
});

const io = attachRealtime(server);

server.listen(port, "0.0.0.0", () => {
  console.log(`Realtime service listening on port ${port}`);
});
