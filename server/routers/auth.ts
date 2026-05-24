import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import {
  hashPassword,
  signSession,
  verifyPassword,
} from "../_core/auth";
import {
  createLocalUser,
  getUserByEmail,
  touchLastSignedIn,
} from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const emailSchema = z.string().trim().toLowerCase().email("올바른 이메일 형식이 아닙니다");
const passwordSchema = z
  .string()
  .min(6, "비밀번호는 최소 6자 이상이어야 합니다")
  .max(128, "비밀번호가 너무 깁니다");
const nameSchema = z.string().trim().min(1, "이름을 입력해주세요").max(80);

export const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),

  register: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: passwordSchema,
        name: nameSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 가입된 이메일입니다",
        });
      }
      const passwordHash = await hashPassword(input.password);
      const user = await createLocalUser({
        email: input.email,
        name: input.name,
        passwordHash,
      });
      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "회원가입에 실패했습니다",
        });
      }
      const token = await signSession({
        userId: user.id,
        email: user.email ?? input.email,
        name: user.name ?? input.name,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
      };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: z.string().min(1, "비밀번호를 입력해주세요"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "이메일 또는 비밀번호가 일치하지 않습니다",
        });
      }
      const ok = await verifyPassword(input.password, user.passwordHash);
      if (!ok) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "이메일 또는 비밀번호가 일치하지 않습니다",
        });
      }
      await touchLastSignedIn(user.id);
      const token = await signSession({
        userId: user.id,
        email: user.email ?? input.email,
        name: user.name ?? "",
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
      };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  // Change password (logged-in only)
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: passwordSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(ctx.user.email ?? "");
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const ok = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!ok) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "현재 비밀번호가 일치하지 않습니다",
        });
      }
      // Lazy import db here to avoid circular deps
      const { getDb } = await import("../db");
      const { users } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const newHash = await hashPassword(input.newPassword);
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
      return { success: true };
    }),
});
