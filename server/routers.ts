import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { authRouter } from "./routers/auth";
import { chatRouter } from "./routers/chat";
import { friendsRouter } from "./routers/friends";
import { invitesRouter } from "./routers/invites";
import { messagesRouter } from "./routers/messages";
import { pushRouter } from "./routers/push";
import { usersRouter } from "./routers/users";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  chat: chatRouter,
  messages: messagesRouter,
  invites: invitesRouter,
  push: pushRouter,
  users: usersRouter,
  friends: friendsRouter,
});

export type AppRouter = typeof appRouter;
