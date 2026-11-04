import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be between 1 and 65535");
// src/ and dist/ both sit directly beneath apps/server.
const clientDirectory = fileURLToPath(
  new URL("../../client/dist/", import.meta.url),
);
const { http, io } = createApp(clientDirectory);
http.listen(port, "0.0.0.0", () =>
  console.log(`crazy myangcade server listening on port ${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => io.close());
