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

const readme = `크레이지 먕케이드 / crazy myangcade

Windows 10/11 64비트용 1인 연습·온라인 대전 배포본
Node.js와 npm을 따로 설치할 필요가 없습니다.
한 캐릭터로 혼자 연습하거나 각자 PC에서 온라인 1:1 대전을 즐깁니다.

혼자 연습하기:
ZIP을 압축 해제하고 crazy-myangcade.exe를 더블클릭한 뒤 1인 연습 모드를 누르세요.
상대나 방 참가 없이 시작합니다. 화면 중앙의 3 → 2 → 1 → Game Start! 후 조작할 수 있습니다.
해적선 2종·마을·광산·공장·숲·유적 중 무작위 맵에서 캐릭터 한 명으로 시간제한 없이 연습합니다.
처음부터 다시 버튼으로 맵·아이템·능력치를 초기화합니다.

온라인 대전하기:
1. 호스트 PC에서 ZIP을 압축 해제하고 crazy-myangcade.exe를 더블클릭하세요.
2. 열린 브라우저에서 온라인 대전 → 닉네임 입력 → 방 만들기를 누르세요.
3. 초대 링크 복사를 눌러 같은 네트워크의 상대에게 보내세요.
   상대는 받은 주소를 브라우저에 열고 닉네임을 입력해 방 참가하기를 누릅니다.
   상대는 EXE를 따로 실행할 필요가 없습니다. 각자 EXE를 켜면 서로 다른 서버입니다.
4. 둘 다 READY를 누르면 3초 뒤 시작합니다.
   경기장 중앙에 3 → 2 → 1 → Game Start!가 표시되며 카운트다운 중에는 조작할 수 없습니다.
5. 서버 창은 경기 중 계속 켜 두세요. 종료는 창 닫기 또는 Ctrl+C입니다.

조작: 방향키 이동 / Space 물풍선 / Ctrl 아이템 (왼쪽·오른쪽 모두)
전체 맵은 승인된 파스텔 색감입니다. 캐릭터·물풍선·아이템·물줄기는 기존 색상을 유지합니다.
키를 짧게 눌러도 한 칸의 중심까지 부드럽게 이동하고, 중심에서 멈추거나 방향을 바꿉니다.
방향키를 겹쳐 누르면 새 방향으로 꺾고, 그 키를 떼면 계속 누르고 있던 방향으로 돌아갑니다.
바닥 아이템은 생성/착지 후 15초 유지되며 마지막 3초 동안 옅어져 사라집니다.
타일 중심 가까이에서 열린 방향으로 꺾으면 정렬 보정이 적용됩니다. 짧은 방향 입력은 최대 0.35초 보관합니다.
벽에 막혀도 방향키를 누르는 동안 제자리 걷기를 계속합니다. 키를 떼면 멈춥니다.
물풍선에 갇혔을 때 남은 시간 숫자는 표시하지 않습니다.
죽으면 아이템이 사망 위치에서 빈 타일로 날아가 착지합니다.
캐릭터와 경기 화면을 확대했으며 바닥 아이템은 이전보다 1.5배 커졌습니다.
시작 전 메뉴의 캐릭터 선택에서 13종 중 하나를 고르세요. 능력치는 모두 동일합니다.
캐릭터를 고른 뒤 연습 또는 온라인 방 만들기·참가를 누릅니다. 재시작·재대결에도 유지됩니다.
연습/온라인 모두 시작·재시작·재대결마다 직전과 다른 맵과 빈 타일의 시작 위치를 무작위로 고릅니다.
사망과 재접속은 맵을 바꾸지 않습니다.
아이템: 합계 최대 2개, 획득 순서대로 하나씩 사용합니다.
1번/2번 칸이 가득 찼을 때 새 아이템을 먹으면 오래된 1번을 버리고, 기존 2번은 1번으로 옮기며 새 아이템은 2번에 저장합니다.
시작 아이템은 없습니다. 액체·롤러스케이트·울트라 물풍선은 획득 즉시 적용됩니다.
울트라 물풍선은 물줄기를 최대로 올리며 시간제한이 없습니다. 패시브는 보관 칸을 쓰지 않습니다.
울트라의 상자당 출현 확률은 3.75%로 기존의 절반입니다.
파란 얼굴 물풍선은 개수 +1 아이템이며, Space 설치 풍선은 반짝이는 보라색 구체입니다.
장갑·신발·고스트는 테스트 동안 등장하지 않습니다.
바늘·쉴드는 상자에서 획득해 최대 2칸에 저장합니다. Ctrl로 획득 순서대로 사용합니다.
바늘은 물풍선에 갇혔을 때 탈출하며, 쉴드는 사용 시 4초간 보호합니다. 획득만으로 발동하지 않습니다.
내 캐릭터 머리 위에는 하늘색 화살표가 표시됩니다.
물풍선에 갇히면 5초 동안 0.8칸/초로 이동할 수 있습니다.
죽으면 남은 사용 아이템과 개수/속도/물줄기 강화분, 울트라가 드롭 대상입니다.
대상이 3개 이하면 전부, 4개 이상이면 80%(소수점 버림)를 맵 전체 바닥에 무작위로 떨어뜨립니다.
부활은 물풍선·아이템·폭발·다른 플레이어·근접 몬스터가 없는 안전한 빈 칸 중 무작위 위치입니다.
울트라는 액체 여러 개로 환산하지 않습니다. 모든 강화와 보관함은 초기화하며 기본 능력치로 다시 태어납니다.
13종 모두 좌우 옆모습·뒷모습과 걷기 동작이 적용됩니다. 멈추면 마지막 방향을 유지합니다.
갇힌 물풍선은 점점 하얘지고 터진 뒤 엎드림·페이드를 거쳐 부활합니다.
소리는 게임 화면의 소리 켜기 버튼을 누르세요.

브라우저가 자동으로 열리지 않으면 서버 창의 GAME_URL 주소를 여세요.
상대에게는 FRIEND_URL 주소와 방 코드를 알려줘도 됩니다.
127.0.0.1이나 localhost는 각자의 PC를 뜻하므로 상대에게 보내지 마세요.
기본 포트는 3001이며 사용 중이면 빈 포트를 자동으로 선택합니다.
같은 공유기/LAN의 연결을 지원하며 호스트 PC의 해당 포트에 접근할 수 있어야 합니다.
Windows 방화벽의 네트워크 허용 안내가 나오면 사용하는 사설 네트워크에서 허용하세요.
서로 다른 집에서 플레이하려면 두 PC가 접속할 공통 서버 주소가 필요합니다.
인터넷 공개 서버는 아직 배포하지 않았습니다. 방과 점수는 서버 종료 시 사라집니다.
코드 서명 인증서가 없는 테스트 빌드라 Windows 미확인 앱 안내가 표시될 수 있습니다.

소스와 업데이트: https://github.com/ahngroot/crazy-arcade
포함 Node.js 런타임: ${version}
`;
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
