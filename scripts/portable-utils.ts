import { createHash } from "node:crypto";

export function checksumFor(manifest: string, filename: string) {
  const entries = manifest
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/));
  const hash = entries.find(([, name]) => name === filename)?.[0];
  if (!hash || !/^[a-f0-9]{64}$/.test(hash))
    throw Error(`No SHA-256 checksum for ${filename}`);
  return hash;
}
export function verifyChecksum(bytes: Uint8Array, expected: string) {
  if (createHash("sha256").update(bytes).digest("hex") !== expected)
    throw Error("Downloaded Node.js archive checksum mismatch");
}

/** Official node.exe is signed. Remove its old certificate before modifying the image. */
export function unsignedWindowsImage(bytes: Uint8Array): Buffer {
  const data = Buffer.from(bytes);
  if (data.length < 64 || data.toString("ascii", 0, 2) !== "MZ")
    throw Error("Expected a Windows PE executable");
  const pe = data.readUInt32LE(0x3c),
    optional = pe + 24;
  if (pe + 24 > data.length || data.toString("ascii", pe, pe + 4) !== "PE\0\0")
    throw Error("Invalid PE header");
  if (optional + 152 > data.length || data.readUInt16LE(optional) !== 0x20b)
    throw Error("Expected a 64-bit Windows executable");
  const certificate = optional + 112 + 4 * 8;
  const offset = data.readUInt32LE(certificate),
    size = data.readUInt32LE(certificate + 4);
  data.fill(0, certificate, certificate + 8);
  data.writeUInt32LE(0, optional + 64);
  if (size === 0) return data;
  if (offset < optional + 152 || offset + size !== data.length)
    throw Error("Unexpected PE certificate layout");
  return data.subarray(0, offset);
}
