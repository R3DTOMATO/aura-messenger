import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { deletePushSubscription, savePushSubscription } from "../db";
import { getVapidPublicKey } from "../push";

export const pushRouter = router({
  // VAPID public key for the client to subscribe (public — no auth required)
  publicKey: publicProcedure.query(() => {
    return { publicKey: getVapidPublicKey() };
  }),

  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
        userAgent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await savePushSubscription(ctx.user.id, {
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent,
      });
      return { success: true };
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      await deletePushSubscription(ctx.user.id, input.endpoint);
      return { success: true };
    }),
});
