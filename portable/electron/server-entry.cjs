// This entry only starts the packaged standalone server; no arbitrary script path is accepted.
const path = require("node:path");
const runtime = path.join(__dirname, "runtime", "server.js");
if (process.argv[2] !== runtime || !process.env.PORTABLE_DESKTOP_INSTANCE_TOKEN) process.exit(1);
process.once("message", (message) => {
  if (message?.type === "covex-shutdown") process.emit("SIGTERM");
});
process.once("disconnect", () => process.emit("SIGTERM"));
require(runtime);
