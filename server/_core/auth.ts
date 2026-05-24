import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  userId: number;
  email: string;
  name: string;
};

function getSessionSecret(): Uint8Array {
  const secret = ENV.cookieSecret;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not configured. Set JWT_SECRET in your .env file."
    );
  }
  return new TextEncoder().encode(secret);
}

// ── Password hashing (scrypt, no native deps) ────────────────────
const SCRYPT_KEYLEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(plain, salt, SCRYPT_KEYLEN);
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(plain, salt, SCRYPT_KEYLEN);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

// ── Sessions ─────────────────────────────────────────────────────
export async function signSession(payload: SessionPayload, expiresInMs = ONE_YEAR_MS): Promise<string> {
  const issuedAt = Date.now();
  const exp = Math.floor((issuedAt + expiresInMs) / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(exp)
    .setIssuedAt(Math.floor(issuedAt / 1000))
    .sign(getSessionSecret());
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });
    const { userId, email, name } = payload as Record<string, unknown>;
    if (typeof userId !== "number" || !isNonEmptyString(email) || typeof name !== "string") {
      return null;
    }
    return { userId, email, name };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Auth] Session verification failed:", String(error));
    }
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined) {
  if (!cookieHeader) return new Map<string, string>();
  return new Map(Object.entries(parseCookieHeader(cookieHeader)));
}

export async function authenticateRequest(req: Request): Promise<User | null> {
  const cookies = parseCookies(req.headers.cookie);
  const sessionCookie = cookies.get(COOKIE_NAME);
  const session = await verifySession(sessionCookie);
  if (!session) return null;

  const user = await db.getUserById(session.userId);
  if (!user) return null;

  // Touch lastSignedIn periodically (not on every request — only if stale)
  return user;
}
