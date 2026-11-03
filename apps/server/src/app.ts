import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  GAME_CONFIG,
  type ClientEvents,
  type ServerEvents,
} from "@bubble/shared";

export function createApp(clientDirectory?: string) {
  const app = express();
  app.disable("x-powered-by");
  app.get("/health", (_req, res) => res.json({ status: "ok", stage: 1 }));
  if (clientDirectory) app.use(express.static(clientDirectory));
  const http = createServer(app);
  const io = new Server<ClientEvents, ServerEvents>(http, {
    maxHttpBufferSize: 16_384,
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;
      let allowed = !origin;
      try {
        if (origin) allowed = new URL(origin).host === request.headers.host;
      } catch {
        allowed = false;
      }
      callback(null, allowed);
    },
  });
  io.on("connection", (socket) => {
    socket.emit("hello", {
      protocol: 1,
      stage: 1,
      maxPlayers: GAME_CONFIG.maxPlayers,
    });
    socket.on("pingCheck", (reply) => {
      if (typeof reply === "function") reply(Date.now());
    });
  });
  return { app, http, io };
}
