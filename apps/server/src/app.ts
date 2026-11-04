import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  GAME_CONFIG,
  type ClientEvents,
  type ServerEvents,
} from "@bubble/shared";
import { RoomService } from "./rooms.js";

export function createApp(
  clientDirectory?: string,
  clock: () => number = Date.now,
  options: { serveClient?: boolean } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.get("/health", (_req, res) => res.json({ status: "ok", stage: 1 }));
  if (clientDirectory) app.use(express.static(clientDirectory));
  const http = createServer(app);
  const rooms = new RoomService(clock);
  const io = new Server<ClientEvents, ServerEvents>(http, {
    serveClient: options.serveClient ?? true,
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
    const broadcast = () => {
      for (const { socketId, view } of rooms.broadcasts())
        io.to(socketId).emit("room", view);
    };
    socket.on("createRoom", (request, reply) => {
      const result = rooms.create(socket.id, socket.handshake.address, request);
      if (typeof reply === "function") reply(result);
      if (result.ok) broadcast();
    });
    socket.on("joinRoom", (request, reply) => {
      const result = rooms.join(socket.id, socket.handshake.address, request);
      if (typeof reply === "function") reply(result);
      if (result.ok) broadcast();
    });
    socket.on("resumeRoom", (request, reply) => {
      const result = rooms.resume(socket.id, socket.handshake.address, request);
      if (typeof reply === "function") reply(result);
      if (result.ok) broadcast();
    });
    socket.on("readyRoom", (value, reply) => {
      const result = rooms.ready(socket.id, value);
      if (typeof reply === "function") reply(result);
      if (result.ok) broadcast();
    });
    socket.on("leaveRoom", (reply) => {
      const wasInRoom = !!rooms.current(socket.id);
      const result = rooms.leave(socket.id);
      if (typeof reply === "function") reply(result);
      if (wasInRoom) broadcast();
    });
    socket.on("input", (packet) => {
      rooms.input(socket.id, packet);
    });
    socket.on("disconnect", () => {
      rooms.disconnect(socket.id);
      broadcast();
    });
  });
  const simulation = setInterval(
    () => rooms.advance(),
    1000 / GAME_CONFIG.simulationHz,
  );
  const snapshots = setInterval(() => {
    for (const { socketId, view } of rooms.broadcasts())
      io.to(socketId).emit("room", view);
  }, 1000 / GAME_CONFIG.snapshotHz);
  simulation.unref();
  snapshots.unref();
  http.once("close", () => {
    clearInterval(simulation);
    clearInterval(snapshots);
  });
  return { app, http, io, rooms };
}
