import type { RequestHandler } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname } from "node:path";
import { spawn } from "node:child_process";

/** Asset names are an exact allowlist; no extraction or filesystem paths are used. */
export function embeddedClient(
  assets: ReadonlyMap<string, Buffer>,
): RequestHandler {
  if (!assets.has("/index.html"))
    throw Error("The packaged game is missing index.html");
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    let path: string;
    try {
      path = decodeURIComponent(req.path);
    } catch {
      res.sendStatus(400);
      return;
    }
    const asset = assets.get(path === "/" ? "/index.html" : path);
    if (!asset) {
      next();
      return;
    }
    res.type(extname(path === "/" ? "index.html" : path));
    res.setHeader("Cache-Control", "no-cache");
    res.send(asset);
  };
}

/** The portable build is local-only; the OS chooses a free port if 3001 is busy. */
export async function listenLocal(
  server: Server,
  port = 3001,
): Promise<string> {
  async function listen(value: number) {
    await new Promise<void>((resolve, reject) => {
      const fail = (error: Error) => {
        server.off("listening", ready);
        reject(error);
      };
      const ready = () => {
        server.off("error", fail);
        resolve();
      };
      server.once("error", fail);
      server.once("listening", ready);
      server.listen(value, "127.0.0.1");
    });
  }
  try {
    await listen(port);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE" || port !== 3001)
      throw error;
    await listen(0);
  }
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

export function launchBrowser(url: string, onError: (error: Error) => void) {
  // URL is produced by listenLocal; never pass user-provided command text to a shell.
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url))
    throw Error("Invalid local game address");
  const command =
    process.platform === "win32"
      ? "rundll32.exe"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args =
    process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.once("error", onError);
  child.once("exit", (code) => {
    if (code !== null && code !== 0)
      onError(Error(`Browser opener exited with code ${code}`));
  });
  child.unref();
}

export function portableOptions(args: readonly string[]) {
  let port = 3001,
    noBrowser = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--no-browser") {
      noBrowser = true;
      continue;
    }
    if (args[i] === "--port") {
      const value = args[++i];
      if (value === undefined || !/^\d+$/.test(value))
        throw Error("--port requires a number from 0 to 65535");
      port = Number(value);
      if (!Number.isSafeInteger(port) || port > 65535)
        throw Error("--port must be from 0 to 65535");
      continue;
    }
    throw Error(`Unknown argument: ${args[i]}`);
  }
  return { port, noBrowser };
}
