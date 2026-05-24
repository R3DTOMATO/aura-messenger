import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  forwardMessage,
  getBookmarkedMessageIds,
  getConversationById,
  listBookmarks,
  listPinnedMessages,
  pinMessage,
  searchMessages,
  toggleBookmark,
  unpinMessage,
} from "../db";

export const messagesRouter = router({
  // ── Search ──────────────────────────────────────────────────
  search: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(100).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conv = await getConversationById(input.conversationId, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "FORBIDDEN" });
      return searchMessages(
        input.conversationId,
        ctx.user.id,
        input.query,
        input.limit
      );
    }),

  // ── Forward ─────────────────────────────────────────────────
  forward: protectedProcedure
    .input(
      z.object({
        sourceMessageId: z.number(),
        targetConversationIds: z.array(z.number()).min(1).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return forwardMessage(
        input.sourceMessageId,
        input.targetConversationIds,
        ctx.user.id
      );
    }),

  // ── Bookmarks ───────────────────────────────────────────────
  toggleBookmark: protectedProcedure
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return toggleBookmark(input.messageId, ctx.user.id);
    }),

  listBookmarks: protectedProcedure.query(async ({ ctx }) => {
    return listBookmarks(ctx.user.id);
  }),

  getBookmarkedIds: protectedProcedure
    .input(z.object({ messageIds: z.array(z.number()) }))
    .query(async ({ ctx, input }) => {
      const set = await getBookmarkedMessageIds(ctx.user.id, input.messageIds);
      return Array.from(set);
    }),

  // ── Pinned Messages (공지) ──────────────────────────────────
  pin: protectedProcedure
    .input(z.object({ conversationId: z.number(), messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return pinMessage(input.conversationId, input.messageId, ctx.user.id);
    }),

  unpin: protectedProcedure
    .input(z.object({ conversationId: z.number(), messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const conv = await getConversationById(input.conversationId, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "FORBIDDEN" });
      await unpinMessage(input.conversationId, input.messageId);
      return { success: true };
    }),

  listPinned: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const conv = await getConversationById(input.conversationId, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "FORBIDDEN" });
      return listPinnedMessages(input.conversationId);
    }),
});
