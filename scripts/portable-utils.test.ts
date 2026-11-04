import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  checksumFor,
  verifyChecksum,
  unsignedWindowsImage,
} from "./portable-utils";

it("requires the exact archive checksum entry and rejects modified downloads", () => {
  const data = Buffer.from("official test archive"),
    hash = createHash("sha256").update(data).digest("hex");
  expect(checksumFor(`${hash}  node.zip\r\n`, "node.zip")).toBe(hash);
  expect(() => checksumFor(`${hash}  other.zip`, "node.zip")).toThrow();
  expect(() => verifyChecksum(data, hash)).not.toThrow();
  expect(() => verifyChecksum(Buffer.from("modified"), hash)).toThrow(
    "mismatch",
  );
});

function pe() {
  const bytes = Buffer.alloc(512);
  bytes.write("MZ");
  bytes.writeUInt32LE(128, 0x3c);
  bytes.write("PE\0\0", 128);
  bytes.writeUInt16LE(0x20b, 152);
  bytes.writeUInt32LE(480, 296);
  bytes.writeUInt32LE(32, 300);
  bytes.writeUInt32LE(1234, 216);
  return bytes;
}
it("removes an old PE certificate before embedding the modified executable", () => {
  const source = pe(),
    result = unsignedWindowsImage(source);
  expect(result.length).toBe(480);
  expect(result.readUInt32LE(296)).toBe(0);
  expect(result.readUInt32LE(300)).toBe(0);
  expect(result.readUInt32LE(216)).toBe(0);
  expect(source.readUInt32LE(296)).toBe(480);
});
it("rejects unknown or malformed executable formats rather than truncating arbitrary files", () => {
  expect(() => unsignedWindowsImage(Buffer.from("not an exe"))).toThrow();
  const invalid = pe();
  invalid.writeUInt32LE(479, 296);
  expect(() => unsignedWindowsImage(invalid)).toThrow("layout");
  const wrongArch = pe();
  wrongArch.writeUInt16LE(0x10b, 152);
  expect(() => unsignedWindowsImage(wrongArch)).toThrow("64-bit");
});
