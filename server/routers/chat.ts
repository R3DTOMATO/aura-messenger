import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createGroupConversation,
  createMessage,
  deleteMessage,
  getConversationById,
  getConversationsForUser,
  getMessageConversationId,
  getMessages,
  getOrCreateDM,
  leaveConversation,
  markConversationRead,
  searchUsers,
  toggleReaction,
  updateConversationSettings,
} from "../db";
import { storagePut } from "../storage";
import {
  emitConversationDeleted,
  emitMessageDeleted,
  emitNewMessage,
  emitReactionUpdate,
  emitReadReceipt,
} from "../socket";

export const chatRouter = router({
  // List all conversations for current user
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    return getConversationsForUser(ctx.user.id);
  }),

  // Get or create a DM with another user
  getOrCreateDM: protectedProcedure
    .input(z.object({ targetUserId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (input.targetUserId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot DM yourself" });
      }
      return getOrCreateDM(ctx.user.id, input.targetUserId);
    }),

  // Create a group conversation
  createGroup: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        memberIds: z.array(z.number()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createGroupConversation(ctx.user.id, input.name, input.memberIds);
    }),

  // Get messages for a conversation
  getMessages: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        limit: z.number().optional(),
        beforeId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conv = await getConversationById(input.conversationId, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "FORBIDDEN" });
      return getMessages(input.conversationId, input.limit ?? 50, input.beforeId);
    }),

  // Send a text message (with optional reply)
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        content: z.string().min(1).max(4000),
        replyToId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const conv = await getConversationById(input.conversationId, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "FORBIDDEN" });

      const msg = await createMessage({
        conversationId: input.conversationId,
        senderId: ctx.user.id,
        content: input.content,
        type: "text",
        replyToId: input.replyToId,
      });

      await emitNewMessage(input.conversationId, msg);
      return msg;
    }),

  // Upload file and send as message
  uploadFile: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        fileName: z.string(),
        fileSize: z.number(),
        fileMime: z.string(),
        fileData: z.string(),
        replyToId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const conv = await getConversationById(input.conversationId, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "FORBIDDEN" });

      if (input.fileSize > 20 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File too large (max 20MB)" });
      }

      const buffer = Buffer.from(input.fileData, "base64");
      const ext = input.fileName.split(".").pop() ?? "bin";
      const key = `chat/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.fileMime);

      const isImage = input.fileMime.startsWith("image/");
      const msg = await createMessage({
        conversationId: input.conversationId,
        senderId: ctx.user.id,
        type: isImage ? "image" : "file",
        fileUrl: url,
        fileKey: key,
        fileName: input.fileName,
        fileSize: input.fileSize,
        fileMime: input.fileMime,
        replyToId: input.replyToId,
      });

      await emitNewMessage(input.conversationId, msg);
      return msg;
    }),

  // Delete a message (sender only, soft delete)
  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await deleteMessage(input.messageId, ctx.user.id);
      if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "메시지를 삭제할 수 없습니다" });
      const convId = await getMessageConversationId(input.messageId);
      if (convId) emitMessageDeleted(convId, input.messageId);
      return { success: true };
    }),

  // Toggle a reaction on a message
  toggleReaction: protectedProcedure
    .input(z.object({ messageId: z.number(), emoji: z.string().min(1).max(16) }))
    .mutation(async ({ ctx, input }) => {
      const result = await toggleReaction(input.messageId, ctx.user.id, input.emoji);
      const convId = await getMessageConversationId(input.messageId);
      if (convId) {
        emitReactionUpdate(convId, {
          messageId: input.messageId,
          userId: ctx.user.id,
          emoji: input.emoji,
          added: result.added,
        });
      }
      return result;
    }),

  // Mark conversation as read
  markRead: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const conv = await getConversationById(input.conversationId, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "FORBIDDEN" });
      await markConversationRead(input.conversationId, ctx.user.id);
      emitReadReceipt(input.conversationId, ctx.user.id);
      return { success: true };
    }),

  // Update conversation settings (pin, mute, rename per user)
  updateSettings: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        isPinned: z.boolean().optional(),
        isMuted: z.boolean().optional(),
        customName: z.string().max(120).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const conv = await getConversationById(input.conversationId, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "FORBIDDEN" });
      const { conversationId, ...data } = input;
      await updateConversationSettings(conversationId, ctx.user.id, data);
      return { success: true };
    }),

  // Leave conversation
  leave: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const conv = await getConversationById(input.conversationId, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "FORBIDDEN" });
      await leaveConversation(input.conversationId, ctx.user.id);
      emitConversationDeleted(input.conversationId, ctx.user.id);
      return { success: true };
    }),

  // Search users to start a new conversation
  searchUsers: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return searchUsers(input.query, ctx.user.id);
    }),
});
