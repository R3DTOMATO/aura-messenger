import { and, asc, desc, eq, gt, inArray, like, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  conversationParticipants,
  conversations,
  friends,
  inviteLinks,
  messageBookmarks,
  messageReactions,
  messages,
  pinnedMessages,
  pushSubscriptions,
  userPresence,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── Users ──────────────────────────────────────────────────────
export async function createLocalUser(data: {
  email: string;
  name: string;
  passwordHash: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Use email as openId for local accounts (kept for backward compat with schema)
  const openId = `local:${data.email.toLowerCase()}`;
  const role = ENV.ownerOpenId && ENV.ownerOpenId === data.email ? "admin" : "user";
  await db.insert(users).values({
    openId,
    email: data.email,
    name: data.name,
    passwordHash: data.passwordHash,
    loginMethod: "local",
    role,
    lastSignedIn: new Date(),
  });
  const [row] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return row;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function touchLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function updateUserProfile(
  userId: number,
  data: { name?: string; statusMessage?: string | null; avatarUrl?: string | null; backgroundUrl?: string | null }
) {
  const db = await getDb();
  if (!db) return;
  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.statusMessage !== undefined) updateSet.statusMessage = data.statusMessage;
  if (data.avatarUrl !== undefined) updateSet.avatarUrl = data.avatarUrl;
  if (data.backgroundUrl !== undefined) updateSet.backgroundUrl = data.backgroundUrl;
  if (Object.keys(updateSet).length === 0) return;
  await db.update(users).set(updateSet).where(eq(users.id, userId));
}

export async function searchUsers(query: string, excludeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      statusMessage: users.statusMessage,
    })
    .from(users)
    .where(and(ne(users.id, excludeId), or(like(users.name, `%${query}%`), like(users.email, `%${query}%`))))
    .limit(20);
}

// ── Friends ────────────────────────────────────────────────────
export async function listFriends(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: friends.id,
      friendId: friends.friendId,
      nickname: friends.nickname,
      isFavorite: friends.isFavorite,
      isHidden: friends.isHidden,
      isBlocked: friends.isBlocked,
      createdAt: friends.createdAt,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      statusMessage: users.statusMessage,
    })
    .from(friends)
    .innerJoin(users, eq(users.id, friends.friendId))
    .where(eq(friends.userId, userId))
    .orderBy(desc(friends.isFavorite), asc(users.name));

  return rows;
}

export async function addFriend(userId: number, friendId: number) {
  if (userId === friendId) throw new Error("Cannot add yourself as friend");
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .insert(friends)
    .values({ userId, friendId })
    .onDuplicateKeyUpdate({ set: { isHidden: false, isBlocked: false } });
  return { success: true };
}

export async function updateFriend(
  userId: number,
  friendId: number,
  data: { nickname?: string | null; isFavorite?: boolean; isHidden?: boolean; isBlocked?: boolean }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(friends)
    .set(data)
    .where(and(eq(friends.userId, userId), eq(friends.friendId, friendId)));
}

export async function removeFriend(userId: number, friendId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(friends)
    .where(and(eq(friends.userId, userId), eq(friends.friendId, friendId)));
}

// ── Presence ───────────────────────────────────────────────────
export async function upsertPresence(userId: number, isOnline: boolean) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(userPresence)
    .values({ userId, isOnline, lastSeenAt: new Date() })
    .onDuplicateKeyUpdate({ set: { isOnline, lastSeenAt: new Date() } });
}

export async function getPresenceByUserIds(userIds: number[]) {
  if (!userIds.length) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userPresence).where(inArray(userPresence.userId, userIds));
}

// ── Conversations ──────────────────────────────────────────────
export async function getConversationsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  // Get all conversation IDs the user participates in (with per-user settings)
  const myParticipations = await db
    .select({
      conversationId: conversationParticipants.conversationId,
      lastReadAt: conversationParticipants.lastReadAt,
      isPinned: conversationParticipants.isPinned,
      isMuted: conversationParticipants.isMuted,
      customName: conversationParticipants.customName,
    })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userId));

  if (!myParticipations.length) return [];

  const convIds = myParticipations.map((p) => p.conversationId);
  const settingsMap = new Map(myParticipations.map((p) => [p.conversationId, p]));

  const convs = await db
    .select()
    .from(conversations)
    .where(inArray(conversations.id, convIds))
    .orderBy(desc(conversations.updatedAt));

  // For each conversation, get last message + other participants + unread count
  const results = await Promise.all(
    convs.map(async (conv) => {
      const [lastMsg] = await db
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, conv.id), sql`${messages.deletedAt} IS NULL`))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      const allParticipants = await db
        .select({ userId: conversationParticipants.userId })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, conv.id));

      const otherUserIds = allParticipants.map((p) => p.userId).filter((id) => id !== userId);
      const otherUsers =
        otherUserIds.length > 0
          ? await db
              .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl, statusMessage: users.statusMessage })
              .from(users)
              .where(inArray(users.id, otherUserIds))
          : [];

      const settings = settingsMap.get(conv.id)!;
      const unreadCount = settings.lastReadAt
        ? await db
            .select({ count: sql<number>`count(*)` })
            .from(messages)
            .where(
              and(
                eq(messages.conversationId, conv.id),
                ne(messages.senderId, userId),
                gt(messages.createdAt, settings.lastReadAt),
                sql`${messages.deletedAt} IS NULL`
              )
            )
            .then((r) => Number(r[0]?.count ?? 0))
        : 0;

      return {
        ...conv,
        lastMessage: lastMsg ?? null,
        participants: otherUsers,
        memberCount: allParticipants.length,
        unreadCount,
        isPinned: settings.isPinned,
        isMuted: settings.isMuted,
        customName: settings.customName,
      };
    })
  );

  // Sort: pinned first, then by updatedAt desc
  results.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return results;
}

export async function getOrCreateDM(userAId: number, userBId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Find existing DM between the two users
  const existing = await db
    .select({ convId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userAId));

  for (const { convId } of Array.from(existing)) {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, convId), eq(conversations.type, "dm")))
      .limit(1);
    if (!conv) continue;

    const participants = await db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, convId));

    if (participants.length !== 2) continue;

    const participantIds = participants.map((p) => p.userId).sort((a, b) => a - b);
    const targetIds = [userAId, userBId].sort((a, b) => a - b);
    if (participantIds[0] === targetIds[0] && participantIds[1] === targetIds[1]) {
      return conv;
    }
  }

  // Create new DM
  const [result] = await db.insert(conversations).values({ type: "dm", createdBy: userAId });
  const newConvId = (result as { insertId: number }).insertId;

  await db.insert(conversationParticipants).values([
    { conversationId: newConvId, userId: userAId },
    { conversationId: newConvId, userId: userBId },
  ]);

  const [newConv] = await db.select().from(conversations).where(eq(conversations.id, newConvId)).limit(1);
  return newConv;
}

export async function createGroupConversation(
  creatorId: number,
  name: string,
  memberIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const uniqueMembers = Array.from(new Set([creatorId, ...memberIds]));
  if (uniqueMembers.length < 2) throw new Error("Group needs at least 2 members");

  const [result] = await db
    .insert(conversations)
    .values({ type: "group", name, createdBy: creatorId });
  const newConvId = (result as { insertId: number }).insertId;

  await db.insert(conversationParticipants).values(
    uniqueMembers.map((userId) => ({ conversationId: newConvId, userId }))
  );

  // System message
  const creator = await getUserById(creatorId);
  await db.insert(messages).values({
    conversationId: newConvId,
    senderId: creatorId,
    content: `${creator?.name ?? "누군가"}님이 그룹 채팅을 만들었습니다`,
    type: "system",
  });

  const [newConv] = await db.select().from(conversations).where(eq(conversations.id, newConvId)).limit(1);
  return newConv;
}

export async function getConversationById(convId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId)).limit(1);
  if (!conv) return null;

  const participants = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, convId));

  const isMember = participants.some((p) => p.userId === userId);
  if (!isMember) return null;

  return conv;
}

export async function updateConversationSettings(
  conversationId: number,
  userId: number,
  data: { isPinned?: boolean; isMuted?: boolean; customName?: string | null }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(conversationParticipants)
    .set(data)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      )
    );
}

export async function leaveConversation(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  const user = await getUserById(userId);
  // System message before leaving
  await db.insert(messages).values({
    conversationId,
    senderId: userId,
    content: `${user?.name ?? "누군가"}님이 나갔습니다`,
    type: "system",
  });
  await db
    .delete(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      )
    );
}

// ── Messages ───────────────────────────────────────────────────
export async function getMessages(conversationId: number, limit = 50, beforeId?: number) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(messages.conversationId, conversationId), sql`${messages.deletedAt} IS NULL`];
  if (beforeId) conditions.push(sql`${messages.id} < ${beforeId}`);

  const msgs = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  if (msgs.length === 0) return [];

  // Attach sender info
  const senderIds = Array.from(new Set(msgs.map((m) => m.senderId)));
  const senders = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, senderIds));
  const senderMap = new Map(senders.map((s) => [s.id, s]));

  // Attach reply-to messages
  const replyIds = msgs
    .map((m) => m.replyToId)
    .filter((id): id is number => id !== null);
  const replyMessages =
    replyIds.length > 0
      ? await db
          .select({
            id: messages.id,
            senderId: messages.senderId,
            content: messages.content,
            type: messages.type,
            fileName: messages.fileName,
          })
          .from(messages)
          .where(inArray(messages.id, replyIds))
      : [];
  const replyMap = new Map(replyMessages.map((m) => [m.id, m]));

  // Hydrate reply sender names
  const replySenderIds = Array.from(new Set(replyMessages.map((m) => m.senderId))).filter(
    (id) => !senderMap.has(id)
  );
  if (replySenderIds.length > 0) {
    const extra = await db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(inArray(users.id, replySenderIds));
    extra.forEach((s) => senderMap.set(s.id, s));
  }

  // Attach reactions
  const msgIds = msgs.map((m) => m.id);
  const reactions = await db
    .select()
    .from(messageReactions)
    .where(inArray(messageReactions.messageId, msgIds));
  const reactionsByMsg = new Map<number, { emoji: string; userId: number }[]>();
  for (const r of reactions) {
    if (!reactionsByMsg.has(r.messageId)) reactionsByMsg.set(r.messageId, []);
    reactionsByMsg.get(r.messageId)!.push({ emoji: r.emoji, userId: r.userId });
  }

  return msgs.reverse().map((m) => {
    const reply = m.replyToId ? replyMap.get(m.replyToId) : null;
    return {
      ...m,
      sender: senderMap.get(m.senderId) ?? null,
      replyTo: reply
        ? {
            id: reply.id,
            content: reply.content,
            type: reply.type,
            fileName: reply.fileName,
            sender: senderMap.get(reply.senderId) ?? null,
          }
        : null,
      reactions: reactionsByMsg.get(m.id) ?? [],
    };
  });
}

export async function createMessage(data: {
  conversationId: number;
  senderId: number;
  content?: string;
  type: "text" | "image" | "file" | "system";
  fileUrl?: string;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  replyToId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [result] = await db.insert(messages).values({
    conversationId: data.conversationId,
    senderId: data.senderId,
    content: data.content ?? null,
    type: data.type,
    fileUrl: data.fileUrl ?? null,
    fileKey: data.fileKey ?? null,
    fileName: data.fileName ?? null,
    fileSize: data.fileSize ?? null,
    fileMime: data.fileMime ?? null,
    replyToId: data.replyToId ?? null,
  });

  const newId = (result as { insertId: number }).insertId;

  // Update conversation updatedAt
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, data.conversationId));

  const [msg] = await db.select().from(messages).where(eq(messages.id, newId)).limit(1);
  const sender = await getUserById(data.senderId);

  // Hydrate replyTo if provided
  let replyTo: {
    id: number;
    content: string | null;
    type: string;
    fileName: string | null;
    sender: { id: number; name: string | null; avatarUrl: string | null } | null;
  } | null = null;
  if (data.replyToId) {
    const [rep] = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        content: messages.content,
        type: messages.type,
        fileName: messages.fileName,
      })
      .from(messages)
      .where(eq(messages.id, data.replyToId))
      .limit(1);
    if (rep) {
      const repSender = await getUserById(rep.senderId);
      replyTo = {
        id: rep.id,
        content: rep.content,
        type: rep.type,
        fileName: rep.fileName,
        sender: repSender ? { id: repSender.id, name: repSender.name, avatarUrl: repSender.avatarUrl ?? null } : null,
      };
    }
  }

  return {
    ...msg,
    sender: sender ? { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl ?? null } : null,
    replyTo,
    reactions: [] as { emoji: string; userId: number }[],
  };
}

export async function deleteMessage(messageId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  // Only sender can delete
  const [msg] = await db
    .select({ senderId: messages.senderId, conversationId: messages.conversationId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  if (!msg || msg.senderId !== userId) return false;
  await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, messageId));
  return true;
}

export async function markConversationRead(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(conversationParticipants)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      )
    );
}

export async function getConversationParticipantIds(conversationId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, conversationId));
  return rows.map((r) => r.userId);
}

// ── Reactions ─────────────────────────────────────────────────
export async function toggleReaction(messageId: number, userId: number, emoji: string) {
  const db = await getDb();
  if (!db) return { added: false };

  const existing = await db
    .select()
    .from(messageReactions)
    .where(
      and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.emoji, emoji)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(messageReactions)
      .where(eq(messageReactions.id, existing[0].id));
    return { added: false };
  }

  await db.insert(messageReactions).values({ messageId, userId, emoji });
  return { added: true };
}

export async function getMessageConversationId(messageId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({ conversationId: messages.conversationId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  return row?.conversationId ?? null;
}

// ═══════════════════════════════════════════════════════════════
// ── New Feature Functions ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// ── Message Search ─────────────────────────────────────────────
export async function searchMessages(
  conversationId: number,
  userId: number,
  query: string,
  limit = 30
) {
  const db = await getDb();
  if (!db) return [];

  // Verify the user is in this conversation
  const [participant] = await db
    .select()
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      )
    )
    .limit(1);
  if (!participant) return [];

  // LIKE search (works without fulltext index, slower for big datasets)
  const trimmed = query.trim();
  if (!trimmed) return [];

  const msgs = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        sql`${messages.deletedAt} IS NULL`,
        ne(messages.type, "system"),
        like(messages.content, `%${trimmed}%`)
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  if (msgs.length === 0) return [];

  // Hydrate sender info
  const senderIds = Array.from(new Set(msgs.map((m) => m.senderId)));
  const senders = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, senderIds));
  const senderMap = new Map(senders.map((s) => [s.id, s]));

  return msgs.map((m) => ({
    ...m,
    sender: senderMap.get(m.senderId) ?? null,
  }));
}

// ── Message Forwarding ─────────────────────────────────────────
export async function forwardMessage(
  sourceMessageId: number,
  targetConversationIds: number[],
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Load source message
  const [source] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, sourceMessageId))
    .limit(1);
  if (!source) throw new Error("원본 메시지를 찾을 수 없습니다");

  // Verify user can access source conversation
  const [sourceParticipant] = await db
    .select()
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, source.conversationId),
        eq(conversationParticipants.userId, userId)
      )
    )
    .limit(1);
  if (!sourceParticipant) throw new Error("이 메시지에 접근할 수 없습니다");

  const created: number[] = [];
  for (const targetConvId of targetConversationIds) {
    // Verify user is in target conversation
    const [targetParticipant] = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, targetConvId),
          eq(conversationParticipants.userId, userId)
        )
      )
      .limit(1);
    if (!targetParticipant) continue;

    const [result] = await db.insert(messages).values({
      conversationId: targetConvId,
      senderId: userId,
      content: source.content,
      type: source.type,
      fileUrl: source.fileUrl,
      fileKey: source.fileKey,
      fileName: source.fileName,
      fileSize: source.fileSize,
      fileMime: source.fileMime,
    });
    const newId = (result as { insertId: number }).insertId;
    created.push(newId);

    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, targetConvId));
  }

  return { forwardedCount: created.length, messageIds: created };
}

// ── Bookmarks ──────────────────────────────────────────────────
export async function toggleBookmark(messageId: number, userId: number) {
  const db = await getDb();
  if (!db) return { bookmarked: false };

  const existing = await db
    .select()
    .from(messageBookmarks)
    .where(
      and(
        eq(messageBookmarks.messageId, messageId),
        eq(messageBookmarks.userId, userId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db.delete(messageBookmarks).where(eq(messageBookmarks.id, existing[0].id));
    return { bookmarked: false };
  }

  await db.insert(messageBookmarks).values({ messageId, userId });
  return { bookmarked: true };
}

export async function listBookmarks(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: messageBookmarks.id,
      createdAt: messageBookmarks.createdAt,
      messageId: messages.id,
      content: messages.content,
      type: messages.type,
      fileUrl: messages.fileUrl,
      fileName: messages.fileName,
      conversationId: messages.conversationId,
      messageCreatedAt: messages.createdAt,
      senderId: messages.senderId,
    })
    .from(messageBookmarks)
    .innerJoin(messages, eq(messages.id, messageBookmarks.messageId))
    .where(eq(messageBookmarks.userId, userId))
    .orderBy(desc(messageBookmarks.createdAt))
    .limit(100);

  if (rows.length === 0) return [];

  const senderIds = Array.from(new Set(rows.map((r) => r.senderId)));
  const senders = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, senderIds));
  const senderMap = new Map(senders.map((s) => [s.id, s]));

  return rows.map((r) => ({
    ...r,
    sender: senderMap.get(r.senderId) ?? null,
  }));
}

export async function getBookmarkedMessageIds(userId: number, messageIds: number[]) {
  if (messageIds.length === 0) return new Set<number>();
  const db = await getDb();
  if (!db) return new Set<number>();
  const rows = await db
    .select({ messageId: messageBookmarks.messageId })
    .from(messageBookmarks)
    .where(
      and(
        eq(messageBookmarks.userId, userId),
        inArray(messageBookmarks.messageId, messageIds)
      )
    );
  return new Set(rows.map((r) => r.messageId));
}

// ── Pinned Messages (공지) ─────────────────────────────────────
export async function pinMessage(conversationId: number, messageId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Verify user is in this conversation
  const [participant] = await db
    .select()
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      )
    )
    .limit(1);
  if (!participant) throw new Error("권한이 없습니다");

  // Verify message belongs to this conversation
  const [msg] = await db
    .select({ conversationId: messages.conversationId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  if (!msg || msg.conversationId !== conversationId) {
    throw new Error("메시지를 찾을 수 없습니다");
  }

  await db
    .insert(pinnedMessages)
    .values({ conversationId, messageId, pinnedBy: userId })
    .onDuplicateKeyUpdate({ set: { pinnedBy: userId } });

  return { success: true };
}

export async function unpinMessage(conversationId: number, messageId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(pinnedMessages)
    .where(
      and(
        eq(pinnedMessages.conversationId, conversationId),
        eq(pinnedMessages.messageId, messageId)
      )
    );
}

export async function listPinnedMessages(conversationId: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      pinId: pinnedMessages.id,
      pinnedAt: pinnedMessages.createdAt,
      pinnedBy: pinnedMessages.pinnedBy,
      messageId: messages.id,
      content: messages.content,
      type: messages.type,
      fileUrl: messages.fileUrl,
      fileName: messages.fileName,
      messageCreatedAt: messages.createdAt,
      senderId: messages.senderId,
    })
    .from(pinnedMessages)
    .innerJoin(messages, eq(messages.id, pinnedMessages.messageId))
    .where(eq(pinnedMessages.conversationId, conversationId))
    .orderBy(desc(pinnedMessages.createdAt))
    .limit(20);

  if (rows.length === 0) return [];

  const senderIds = Array.from(new Set(rows.map((r) => r.senderId)));
  const senders = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, senderIds));
  const senderMap = new Map(senders.map((s) => [s.id, s]));

  return rows.map((r) => ({
    ...r,
    sender: senderMap.get(r.senderId) ?? null,
  }));
}

// ── Invite Links ───────────────────────────────────────────────
function generateInviteCode(): string {
  // 10-character random code
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit I, O, 0, 1 for clarity
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createInviteLink(
  ownerId: number,
  options: { maxUses?: number; expiresInDays?: number } = {}
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  let code = generateInviteCode();
  // Retry if collision (very rare)
  for (let i = 0; i < 5; i++) {
    const existing = await db
      .select({ id: inviteLinks.id })
      .from(inviteLinks)
      .where(eq(inviteLinks.code, code))
      .limit(1);
    if (existing.length === 0) break;
    code = generateInviteCode();
  }

  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  await db.insert(inviteLinks).values({
    code,
    ownerId,
    maxUses: options.maxUses ?? null,
    expiresAt,
  });

  return { code };
}

export async function getActiveInviteLinks(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(inviteLinks)
    .where(and(eq(inviteLinks.ownerId, ownerId), eq(inviteLinks.isActive, true)))
    .orderBy(desc(inviteLinks.createdAt))
    .limit(20);
}

export async function revokeInviteLink(code: string, ownerId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(inviteLinks)
    .set({ isActive: false })
    .where(and(eq(inviteLinks.code, code), eq(inviteLinks.ownerId, ownerId)));
}

export async function consumeInviteLink(code: string, currentUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [link] = await db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.code, code))
    .limit(1);

  if (!link) throw new Error("유효하지 않은 초대 링크입니다");
  if (!link.isActive) throw new Error("이 초대 링크는 비활성화되었습니다");
  if (link.expiresAt && link.expiresAt < new Date()) {
    throw new Error("이 초대 링크는 만료되었습니다");
  }
  if (link.maxUses && link.usedCount >= link.maxUses) {
    throw new Error("이 초대 링크는 사용 횟수를 초과했습니다");
  }
  if (link.ownerId === currentUserId) {
    throw new Error("자기 자신의 초대 링크는 사용할 수 없습니다");
  }

  // Add mutual friendship (both directions)
  await db
    .insert(friends)
    .values({ userId: currentUserId, friendId: link.ownerId })
    .onDuplicateKeyUpdate({ set: { isHidden: false, isBlocked: false } });
  await db
    .insert(friends)
    .values({ userId: link.ownerId, friendId: currentUserId })
    .onDuplicateKeyUpdate({ set: { isHidden: false, isBlocked: false } });

  // Increment use count
  await db
    .update(inviteLinks)
    .set({ usedCount: link.usedCount + 1 })
    .where(eq(inviteLinks.id, link.id));

  return { ownerId: link.ownerId };
}

// ── Push Subscriptions ─────────────────────────────────────────
export async function savePushSubscription(
  userId: number,
  data: { endpoint: string; p256dh: string; auth: string; userAgent?: string }
) {
  const db = await getDb();
  if (!db) return;

  // Avoid duplicates by endpoint
  const existing = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, data.endpoint))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ userId, p256dh: data.p256dh, auth: data.auth, userAgent: data.userAgent ?? null })
      .where(eq(pushSubscriptions.id, existing[0].id));
    return;
  }

  await db.insert(pushSubscriptions).values({
    userId,
    endpoint: data.endpoint,
    p256dh: data.p256dh,
    auth: data.auth,
    userAgent: data.userAgent ?? null,
  });
}

export async function deletePushSubscription(userId: number, endpoint: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      )
    );
}

export async function getUserPushSubscriptions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}
