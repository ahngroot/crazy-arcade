import { build } from "esbuild";
import { inject } from "postject";
import { zipSync, unzipSync, strToU8 } from "fflate";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  chmodSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checksumFor,
  verifyChecksum,
  unsignedWindowsImage,
} from "./portable-utils";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const target = args[0] ?? "windows";
if (args.length > 1 || !["windows", "host"].includes(target))
  throw Error("Usage: package-portable.ts windows|host");
if (Number(process.versions.node.split(".")[0]) !== 24)
  throw Error("Build with Node.js 24.x");
if (target === "host" && process.platform !== "linux")
  throw Error("The host smoke build currently supports Linux only");
const version = process.versions.node;
const work = join(root, "build", "portable", target),
  out = join(root, "release");
mkdirSync(work, { recursive: true });
mkdirSync(out, { recursive: true });

function download(url: string, destination: string) {
  execFileSync(
    process.platform === "win32" ? "curl.exe" : "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--retry",
      "2",
      "--max-time",
      "180",
      url,
      "--output",
      destination,
    ],
    { stdio: "inherit" },
  );
}
function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? filesBelow(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
}
const webRoot = join(root, "apps", "client", "dist");
if (!existsSync(join(webRoot, "index.html")))
  throw Error("Run npm run build first");
const webAssets = Object.fromEntries(
  filesBelow(webRoot).map((file) => [
    `web/${relative(webRoot, file).replaceAll("\\", "/")}`,
    file,
  ]),
);

const main = join(work, "launcher.cjs");
await build({
  entryPoints: [join(root, "apps/server/src/standalone.ts")],
  outfile: main,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  sourcemap: false,
  legalComments: "inline",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});
const config = join(work, "sea-config.json"),
  blob = join(work, "game.blob");
writeFileSync(
  config,
  JSON.stringify(
    {
      main,
      output: blob,
      disableExperimentalSEAWarning: true,
      useCodeCache: false,
      useSnapshot: false,
      assets: webAssets,
    },
    null,
    2,
  ),
);
execFileSync(process.execPath, ["--experimental-sea-config", config], {
  cwd: root,
  stdio: "inherit",
});

let nodeLicense: Uint8Array;
const executable = join(
  out,
  target === "windows" ? "crazy-myangcade.exe" : "crazy-myangcade-linux",
);
if (target === "windows") {
  const cache = join(root, ".cache", "portable", version);
  mkdirSync(cache, { recursive: true });
  const filename = `node-v${version}-win-x64.zip`,
    archive = join(cache, filename),
    manifest = join(cache, "SHASUMS256.txt");
  if (!existsSync(manifest))
    download(`https://nodejs.org/dist/v${version}/SHASUMS256.txt`, manifest);
  if (!existsSync(archive))
    download(`https://nodejs.org/dist/v${version}/${filename}`, archive);
  const downloaded = readFileSync(archive);
  verifyChecksum(
    downloaded,
    checksumFor(readFileSync(manifest, "utf8"), filename),
  );
  const prefix = `node-v${version}-win-x64/`;
  const unpacked = unzipSync(downloaded, {
    filter: (file) =>
      file.name === `${prefix}node.exe` || file.name === `${prefix}LICENSE`,
  });
  if (!unpacked[`${prefix}node.exe`] || !unpacked[`${prefix}LICENSE`])
    throw Error("Official Node archive is missing node.exe or LICENSE");
  writeFileSync(
    executable,
    unsignedWindowsImage(unpacked[`${prefix}node.exe`]),
  );
  nodeLicense = unpacked[`${prefix}LICENSE`];
} else {
  copyFileSync(process.execPath, executable);
  chmodSync(executable, 0o755);
  // The host build is an execution test artifact, not a distributed Linux release.
  nodeLicense = strToU8(
    "Host execution-test build; use the Windows ZIP for distribution.",
  );
}
await inject(executable, "NODE_SEA_BLOB", readFileSync(blob), {
  sentinelFuse: "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
});
if (target === "host") {
  console.log(`Host test executable: ${executable}`);
  process.exit(0);
}

const readme = `크레이지 먕케이드 / crazy myangcade\n\nWindows 10/11 64비트용 포터블 테스트 배포본\nNode.js와 npm을 따로 설치할 필요가 없습니다.\n\n1. ZIP을 먼저 압축 해제하세요.\n2. crazy-myangcade.exe를 더블클릭하세요.\n3. 기본 브라우저에 게임이 열립니다. 서버 창은 플레이하는 동안 켜 두세요.\n4. 종료하려면 서버 창을 닫거나 Ctrl+C를 누르세요. 브라우저 탭만 닫으면 서버는 계속 실행됩니다.\n\n화면이 자동으로 열리지 않으면 서버 창의 GAME_URL 주소를 브라우저에 입력하세요.\n기본 주소는 http://127.0.0.1:3001 입니다. 포트 사용 중이면 창에 다른 주소가 표시됩니다.\n\n로컬 2인: P1 WASD / Space / 왼쪽 Ctrl, P2 방향키 / Enter / 오른쪽 Ctrl\n아이템: 합계 최대 2개, Ctrl을 누를 때 획득 순서대로 하나씩 사용합니다.\n시작 아이템은 보호막→파워입니다. 맨 앞 바늘은 갇혔을 때만 사용합니다.\n소리는 게임 화면의 소리 켜기 버튼을 누르세요.\n\n이 배포본은 같은 PC에서만 접속할 수 있습니다. 인터넷 공개 배포가 아닙니다.\n방과 점수는 서버 창을 닫으면 사라집니다.\n게임 실행에는 인터넷 연결이 필요하지 않지만, 기본 브라우저가 설치되어 있어야 합니다.\n코드 서명 인증서가 없는 테스트 빌드입니다. Windows에서 미확인 앱 안내가 표시될 수 있습니다.\n\n소스와 업데이트: https://github.com/ahngroot/crazy-arcade\n포함 Node.js 런타임: ${version}\n`;
const archiveFiles: Record<string, Uint8Array> = {
  "crazy-myangcade.exe": new Uint8Array(readFileSync(executable)),
  "시작하기.txt": strToU8("\uFEFF" + readme),
  "LICENSES/Node.js-LICENSE.txt": nodeLicense,
};
// Include licenses for the production dependency tree used by both bundled server and client.
const npm = process.env.npm_execpath;
if (!npm) throw Error("Run this script through npm run package:windows");
const productionPaths = execFileSync(
  process.execPath,
  [npm, "ls", "--omit=dev", "--all", "--parseable"],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split(/\r?\n/);
const notices: string[] = [];
for (const directory of productionPaths) {
  if (
    !directory.includes("node_modules") ||
    !existsSync(join(directory, "package.json"))
  )
    continue;
  const pkg = JSON.parse(
    readFileSync(join(directory, "package.json"), "utf8"),
  ) as { name: string; version: string; license?: unknown };
  const id = `${pkg.name.replaceAll("/", "__")}@${pkg.version}`;
  notices.push(
    `${pkg.name}@${pkg.version}: ${typeof pkg.license === "string" ? pkg.license : JSON.stringify(pkg.license ?? "see package notices")}`,
  );
  for (const name of readdirSync(directory)) {
    if (
      !/^(licen[cs]e|notice|copying)(\..*)?$/i.test(name) ||
      !statSync(join(directory, name)).isFile()
    )
      continue;
    archiveFiles[`LICENSES/${id}/${name}`] = new Uint8Array(
      readFileSync(join(directory, name)),
    );
  }
}
archiveFiles["LICENSES/THIRD-PARTY.txt"] = strToU8(
  notices.sort().join("\n") + "\n",
);
// GitHub's artifact download is already a ZIP: upload these expanded files to avoid a ZIP inside a ZIP.
const portableDirectory = join(out, "windows-x64");
for (const [name, bytes] of Object.entries(archiveFiles)) {
  const file = join(portableDirectory, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
}
const zipPath = join(out, "crazy-myangcade-windows-x64.zip");
writeFileSync(zipPath, zipSync(archiveFiles, { level: 6 }));
const hashes =
  [zipPath, executable]
    .map(
      (file) =>
        `${createHash("sha256").update(readFileSync(file)).digest("hex")}  ${relative(out, file)}`,
    )
    .join("\n") + "\n";
writeFileSync(join(out, "SHA256SUMS.txt"), hashes);
writeFileSync(
  join(portableDirectory, "SHA256SUMS.txt"),
  `${createHash("sha256").update(readFileSync(executable)).digest("hex")}  crazy-myangcade.exe\n`,
);
console.log(`Windows executable: ${executable}`);
console.log(
  `Windows ZIP: ${zipPath} (${(statSync(zipPath).size / 1024 / 1024).toFixed(1)} MiB)`,
);
