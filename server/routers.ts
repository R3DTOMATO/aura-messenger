import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { authRouter } from "./routers/auth";
import { chatRouter } from "./routers/chat";
import { friendsRouter } from "./routers/friends";
import { usersRouter } from "./routers/users";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  chat: chatRouter,
  users: usersRouter,
  friends: friendsRouter,
});

export type AppRouter = typeof appRouter;
