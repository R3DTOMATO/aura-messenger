import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getPresenceByUserIds,
  getUserById,
  updateUserProfile,
  upsertPresence,
} from "../db";

export const usersRouter = router({
  updatePresence: protectedProcedure
    .input(z.object({ isOnline: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await upsertPresence(ctx.user.id, input.isOnline);
      return { success: true };
    }),

  getPresence: protectedProcedure
    .input(z.object({ userIds: z.array(z.number()) }))
    .query(async ({ input }) => {
      return getPresenceByUserIds(input.userIds);
    }),

  // Update own profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80).optional(),
        statusMessage: z.string().max(140).nullable().optional(),
        avatarUrl: z.string().nullable().optional(),
        backgroundUrl: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateUserProfile(ctx.user.id, input);
      return { success: true };
    }),

  // Get a user by id (for profile view)
  getById: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const user = await getUserById(input.userId);
      if (!user) return null;
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        statusMessage: user.statusMessage,
        backgroundUrl: user.backgroundUrl,
      };
    }),
});
