const http = require("node:http");
const { readinessProof } = require("../../portable/electron/settings.cjs");
const server = http.createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/api/portable/desktop-ready") {
    const challenge = request.headers["x-covex-challenge"];
    response.end(JSON.stringify({ id: process.env.PORTABLE_DESKTOP_INSTANCE_ID, pid: process.pid, mode: process.env.PORTABLE_DESKTOP_MODE, proof: readinessProof(process.env.PORTABLE_DESKTOP_INSTANCE_TOKEN, challenge, process.env.PORTABLE_DESKTOP_INSTANCE_ID, process.pid, process.env.PORTABLE_DESKTOP_MODE) }));
  } else if (request.url === "/api/health" && request.headers.cookie === `covex_desktop_instance=${process.env.PORTABLE_DESKTOP_INSTANCE_TOKEN}`) response.end(JSON.stringify({ status: "ok" }));
  else { response.statusCode = 401; response.end("{}"); }
});
server.listen(Number(process.env.PORT), "127.0.0.1");
process.on("message", (message) => { if (message.type === "covex-shutdown") server.close(() => process.exit(0)); });
process.on("disconnect", () => server.close(() => process.exit(0)));
