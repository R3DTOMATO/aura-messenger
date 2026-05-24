// Firebase Cloud Storage backend.
// Configure either:
//   - FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-key.json (file path), or
//   - FIREBASE_SERVICE_ACCOUNT_JSON='{...}' (raw JSON string), or
//   - GOOGLE_APPLICATION_CREDENTIALS=./firebase-key.json (standard Google env var)
// Plus:
//   - FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

let initialized = false;
function ensureInit() {
  if (initialized) return;
  if (getApps().length === 0) {
    const bucket = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucket) {
      throw new Error("FIREBASE_STORAGE_BUCKET env var is required");
    }

    const credentialPath =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const credentialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    let serviceAccount: Record<string, unknown> | null = null;
    if (credentialJson) {
      serviceAccount = JSON.parse(credentialJson);
    } else if (credentialPath) {
      const full = resolve(process.cwd(), credentialPath);
      serviceAccount = JSON.parse(readFileSync(full, "utf-8"));
    } else {
      throw new Error(
        "Firebase credentials missing. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON."
      );
    }

    initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      storageBucket: bucket,
    });
  }
  initialized = true;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "").replace(/\.\.+/g, ".");
}

function appendHashSuffix(relKey: string): string {
  const hash = randomBytes(4).toString("hex");
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function buildDownloadUrl(bucketName: string, key: string, token: string) {
  const encodedKey = encodeURIComponent(key);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedKey}?alt=media&token=${token}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  ensureInit();
  const key = appendHashSuffix(normalizeKey(relKey));
  const buf =
    typeof data === "string"
      ? Buffer.from(data, "utf8")
      : Buffer.isBuffer(data)
      ? data
      : Buffer.from(data);

  const bucket = getStorage(getApp()).bucket();
  const file = bucket.file(key);
  const token = randomBytes(16).toString("hex");
  await file.save(buf, {
    contentType,
    resumable: false,
    metadata: {
      contentType,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  return { key, url: buildDownloadUrl(bucket.name, key, token) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  ensureInit();
  const key = normalizeKey(relKey);
  const bucket = getStorage(getApp()).bucket();
  const file = bucket.file(key);
  const [meta] = await file.getMetadata();
  const tokens =
    (meta?.metadata?.firebaseStorageDownloadTokens as string | undefined) ?? "";
  const token = tokens.split(",")[0];
  if (!token) {
    throw new Error("File does not have a download token");
  }
  return { key, url: buildDownloadUrl(bucket.name, key, token) };
}

export async function storageDelete(relKey: string): Promise<void> {
  ensureInit();
  const key = normalizeKey(relKey);
  const bucket = getStorage(getApp()).bucket();
  await bucket.file(key).delete({ ignoreNotFound: true });
}
