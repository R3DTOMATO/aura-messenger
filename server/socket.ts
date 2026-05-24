import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { getConversationParticipantIds, upsertPresence } from "./db";
import { sendPushToUsers, type PushPayload } from "./push";

let io: SocketServer | null = null;

// Map userId -> Set of socketIds
const userSockets = new Map<number, Set<string>>();

export function initSocketIO(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/socket.io",
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth?.userId as number | undefined;
    if (!userId) {
      socket.disconnect();
      return;
    }

    // Register socket
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);

    // Mark online
    upsertPresence(userId, true).catch(console.error);
    broadcastPresence(userId, true);

    // Auto-join personal room for direct user-targeted events
    socket.join(`user:${userId}`);

    socket.on("join_conversation", (conversationId: number) => {
      socket.join(`conv:${conversationId}`);
    });

    socket.on("leave_conversation", (conversationId: number) => {
      socket.leave(`conv:${conversationId}`);
    });

    socket.on(
      "typing",
      ({ conversationId, isTyping }: { conversationId: number; isTyping: boolean }) => {
        socket.to(`conv:${conversationId}`).emit("typing", {
          userId,
          conversationId,
          isTyping,
        });
      }
    );

    socket.on("disconnect", () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          upsertPresence(userId, false).catch(console.error);
          broadcastPresence(userId, false);
        }
      }
    });
  });

  return io;
}

function broadcastPresence(userId: number, isOnline: boolean) {
  if (!io) return;
  io.emit("presence_update", { userId, isOnline, lastSeenAt: new Date() });
}

export async function emitNewMessage(conversationId: number, message: unknown) {
  if (!io) return;
  io.to(`conv:${conversationId}`).emit("new_message", message);

  // Also notify participants via their personal room
  const participantIds = await getConversationParticipantIds(conversationId);
  for (const uid of participantIds) {
    io.to(`user:${uid}`).emit("conversation_updated", { conversationId, message });
  }

  // Send web push to offline participants (and senders other than self)
  const msg = message as {
    senderId?: number;
    sender?: { id?: number; name?: string | null };
    content?: string | null;
    type?: string;
    fileName?: string | null;
  };
  const senderId = msg.sender?.id ?? msg.senderId;
  const offlineRecipients = participantIds.filter(
    (uid) => uid !== senderId && !isUserOnline(uid)
  );
  if (offlineRecipients.length > 0) {
    const senderName = msg.sender?.name ?? "새 메시지";
    const preview =
      msg.type === "image"
        ? "📷 사진"
        : msg.type === "file"
        ? `📎 ${msg.fileName ?? "파일"}`
        : (msg.content ?? "").slice(0, 100);
    const payload: PushPayload = {
      title: senderName,
      body: preview,
      url: `/?conversationId=${conversationId}`,
      tag: `conv-${conversationId}`,
    };
    // Fire-and-forget
    sendPushToUsers(offlineRecipients, payload).catch(() => {});
  }
}

export function emitReadReceipt(conversationId: number, userId: number) {
  if (!io) return;
  io.to(`conv:${conversationId}`).emit("read_receipt", {
    conversationId,
    userId,
    readAt: new Date(),
  });
}

export function emitMessageDeleted(conversationId: number, messageId: number) {
  if (!io) return;
  io.to(`conv:${conversationId}`).emit("message_deleted", { conversationId, messageId });
}

export function emitReactionUpdate(
  conversationId: number,
  payload: { messageId: number; userId: number; emoji: string; added: boolean }
) {
  if (!io) return;
  io.to(`conv:${conversationId}`).emit("reaction_update", payload);
}

export function emitConversationDeleted(conversationId: number, userId: number) {
  if (!io) return;
  io.to(`user:${userId}`).emit("conversation_left", { conversationId });
}

export function getIO() {
  return io;
}

export function isUserOnline(userId: number): boolean {
  return (userSockets.get(userId)?.size ?? 0) > 0;
}
