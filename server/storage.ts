// Local filesystem storage. Files are saved under ./uploads and served
// statically at /uploads/* by the express app.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";

const UPLOAD_ROOT = resolve(process.cwd(), "uploads");

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "").replace(/\.\.+/g, ".");
}

function appendHashSuffix(relKey: string): string {
  const hash = randomBytes(4).toString("hex");
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const fullPath = join(UPLOAD_ROOT, key);
  await mkdir(dirname(fullPath), { recursive: true });
  const buf =
    typeof data === "string"
      ? Buffer.from(data, "utf8")
      : Buffer.isBuffer(data)
      ? data
      : Buffer.from(data);
  await writeFile(fullPath, buf);
  return { key, url: `/uploads/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/uploads/${key}` };
}
