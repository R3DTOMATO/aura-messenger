import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { addFriend, listFriends, removeFriend, updateFriend } from "../db";

export const friendsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listFriends(ctx.user.id);
  }),

  add: protectedProcedure
    .input(z.object({ friendId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return addFriend(ctx.user.id, input.friendId);
    }),

  update: protectedProcedure
    .input(
      z.object({
        friendId: z.number(),
        nickname: z.string().max(80).nullable().optional(),
        isFavorite: z.boolean().optional(),
        isHidden: z.boolean().optional(),
        isBlocked: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { friendId, ...data } = input;
      await updateFriend(ctx.user.id, friendId, data);
      return { success: true };
    }),

  remove: protectedProcedure
    .input(z.object({ friendId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await removeFriend(ctx.user.id, input.friendId);
      return { success: true };
    }),
});
