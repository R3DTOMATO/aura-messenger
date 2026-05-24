import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  consumeInviteLink,
  createInviteLink,
  getActiveInviteLinks,
  getUserById,
  revokeInviteLink,
} from "../db";

export const invitesRouter = router({
  // Create a new invite link for the current user
  create: protectedProcedure
    .input(
      z.object({
        maxUses: z.number().min(1).max(1000).optional(),
        expiresInDays: z.number().min(1).max(365).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createInviteLink(ctx.user.id, input);
    }),

  // List my active invite links
  listMine: protectedProcedure.query(async ({ ctx }) => {
    return getActiveInviteLinks(ctx.user.id);
  }),

  // Revoke an invite link
  revoke: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await revokeInviteLink(input.code, ctx.user.id);
      return { success: true };
    }),

  // Preview an invite (public — used by accept page before login)
  preview: publicProcedure
    .input(z.object({ code: z.string().min(1).max(32) }))
    .query(async ({ input }) => {
      // Reuse consume in dry-run by reading the link directly
      const { getDb } = await import("../db");
      const { inviteLinks } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return null;
      const [link] = await db
        .select()
        .from(inviteLinks)
        .where(eq(inviteLinks.code, input.code))
        .limit(1);
      if (!link || !link.isActive) return null;
      if (link.expiresAt && link.expiresAt < new Date()) return null;
      if (link.maxUses && link.usedCount >= link.maxUses) return null;

      const owner = await getUserById(link.ownerId);
      if (!owner) return null;
      return {
        ownerName: owner.name,
        ownerAvatarUrl: owner.avatarUrl,
        ownerStatusMessage: owner.statusMessage,
      };
    }),

  // Accept an invite (must be logged in)
  accept: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(32) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await consumeInviteLink(input.code, ctx.user.id);
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e instanceof Error ? e.message : "초대 링크 사용 실패",
        });
      }
    }),
});
