import {
  bigint,
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ── Users ──────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  avatarUrl: text("avatarUrl"),
  // Local auth (bcrypt hash)
  passwordHash: varchar("passwordHash", { length: 255 }),
  // KakaoTalk-style profile
  statusMessage: varchar("statusMessage", { length: 140 }),
  backgroundUrl: text("backgroundUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Friends ────────────────────────────────────────────────────
export const friends = mysqlTable(
  "friends",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    friendId: int("friendId").notNull(),
    nickname: varchar("nickname", { length: 80 }),
    isFavorite: boolean("isFavorite").default(false).notNull(),
    isHidden: boolean("isHidden").default(false).notNull(),
    isBlocked: boolean("isBlocked").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    pair: uniqueIndex("user_friend_pair").on(t.userId, t.friendId),
  })
);

export type Friend = typeof friends.$inferSelect;

// ── Conversations ──────────────────────────────────────────────
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["dm", "group"]).default("dm").notNull(),
  name: varchar("name", { length: 255 }),
  avatarUrl: text("avatarUrl"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;

// ── Participants ───────────────────────────────────────────────
export const conversationParticipants = mysqlTable("conversation_participants", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  userId: int("userId").notNull(),
  isPinned: boolean("isPinned").default(false).notNull(),
  isMuted: boolean("isMuted").default(false).notNull(),
  customName: varchar("customName", { length: 120 }),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  lastReadAt: timestamp("lastReadAt").defaultNow().notNull(),
});

export type ConversationParticipant = typeof conversationParticipants.$inferSelect;

// ── Messages ───────────────────────────────────────────────────
export const messages = mysqlTable("messages", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  senderId: int("senderId").notNull(),
  content: text("content"),
  type: mysqlEnum("type", ["text", "image", "file", "system"]).default("text").notNull(),
  fileUrl: text("fileUrl"),
  fileKey: text("fileKey"),
  fileName: varchar("fileName", { length: 255 }),
  fileSize: bigint("fileSize", { mode: "number" }),
  fileMime: varchar("fileMime", { length: 128 }),
  replyToId: bigint("replyToId", { mode: "number" }),
  editedAt: timestamp("editedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type Message = typeof messages.$inferSelect;

// ── Message Reactions ──────────────────────────────────────────
export const messageReactions = mysqlTable(
  "message_reactions",
  {
    id: int("id").autoincrement().primaryKey(),
    messageId: bigint("messageId", { mode: "number" }).notNull(),
    userId: int("userId").notNull(),
    emoji: varchar("emoji", { length: 16 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("msg_user_emoji").on(t.messageId, t.userId, t.emoji),
  })
);

export type MessageReaction = typeof messageReactions.$inferSelect;

// ── User Presence ──────────────────────────────────────────────
export const userPresence = mysqlTable("user_presence", {
  userId: int("userId").primaryKey(),
  isOnline: boolean("isOnline").default(false).notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
});

export type UserPresence = typeof userPresence.$inferSelect;
