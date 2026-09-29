import "server-only";
import type { FileKind } from "./rules";

// Number of leading bytes needed by signatureMatches.
export const SIGNATURE_BYTES = 512;

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

// Text formats (ASCII STL, OBJ, PLY headers) should not contain control bytes.
function looksLikeText(bytes: Uint8Array) {
  return bytes.every((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b !== 127));
}

const ZIP = [0x50, 0x4b, 0x03, 0x04];

// Checks the file's leading bytes against its declared type, so a renamed
// executable or document is rejected even with an accepted extension.
export function signatureMatches(kind: FileKind, bytes: Uint8Array, size: number) {
  switch (kind) {
    case "stl": {
      if (ascii(bytes, 0, 5).toLowerCase() === "solid" && looksLikeText(bytes.subarray(0, 256))) {
        return true;
      }
      // Binary STL: 80-byte header, triangle count, 50 bytes per triangle.
      if (bytes.length < 84) return false;
      const triangles = new DataView(bytes.buffer, bytes.byteOffset).getUint32(80, true);
      return size === 84 + triangles * 50;
    }
    case "ply":
      return ascii(bytes, 0, 3) === "ply";
    case "obj":
      return looksLikeText(bytes);
    case "3mf":
    case "zip":
      // Also allow an empty archive.
      return startsWith(bytes, ZIP) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]);
    case "dicom":
      // Standard files carry "DICM" after a 128-byte preamble.
      return ascii(bytes, 128, 132) === "DICM";
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "heic":
      return ascii(bytes, 4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|mif1|msf1|heim|heis)$/.test(ascii(bytes, 8, 12));
    case "pdf":
      return ascii(bytes, 0, 1024).includes("%PDF-");
  }
}
