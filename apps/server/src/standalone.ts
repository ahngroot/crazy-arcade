import { getAsset, getAssetKeys, isSea } from "node:sea";
import { createInterface } from "node:readline";
import { createApp } from "./app";
import {
  embeddedClient,
  launchBrowser,
  listenGame,
  lanGameUrls,
  portableOptions,
} from "./portable";

async function main() {
  if (!isSea())
    throw Error(
      "Build the portable executable before running this entry point.",
    );
  const options = portableOptions(process.argv.slice(2));
  const assets = new Map(
    getAssetKeys()
      .filter((key) => key.startsWith("web/"))
      .map((key) => [`/${key.slice(4)}`, Buffer.from(getAsset(key))]),
  );
  const server = createApp(undefined, Date.now, { serveClient: false });
  server.app.use(embeddedClient(assets));
  const url = await listenGame(server.http, options.port);
  console.log("\ncrazy myangcade - online duel\n");
  console.log(`GAME_URL=${url}`);
  for (const address of lanGameUrls(url)) console.log(`FRIEND_URL=${address}`);
  console.log("Share a FRIEND_URL with the other PC on the same network.");
  console.log(
    "\nKeep this window open while playing. Close it or press Ctrl+C to stop.\n",
  );
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    server.io.close(() => {
      process.stdin.pause();
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  if (process.platform === "win32") process.once("SIGBREAK", shutdown);
  if (!options.noBrowser)
    launchBrowser(url, () =>
      console.error(`Open your browser manually: ${url}`),
    );
}

main().catch((error) => {
  console.error(
    `Could not start crazy myangcade: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
  if (process.stdin.isTTY) {
    const terminal = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    terminal.question("Press Enter to close this window. ", () =>
      terminal.close(),
    );
  }
});
