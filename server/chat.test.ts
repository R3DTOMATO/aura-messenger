import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getConversationsForUser: vi.fn().mockResolvedValue([]),
  getOrCreateDM: vi.fn().mockResolvedValue({
    id: 1,
    type: "dm",
    name: null,
    avatarUrl: null,
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  createGroupConversation: vi.fn().mockResolvedValue({
    id: 2,
    type: "group",
    name: "Test Group",
    avatarUrl: null,
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getConversationById: vi.fn().mockResolvedValue({
    id: 1,
    type: "dm",
    name: null,
    avatarUrl: null,
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getMessages: vi.fn().mockResolvedValue([]),
  createMessage: vi
    .fn()
    .mockImplementation(async (data: { content?: string; type: string }) => ({
      id: 1,
      conversationId: 1,
      senderId: 1,
      content: data.content ?? null,
      type: data.type,
      fileUrl: null,
      fileKey: null,
      fileName: null,
      fileSize: null,
      fileMime: null,
      replyToId: null,
      editedAt: null,
      createdAt: new Date(),
      deletedAt: null,
      sender: { id: 1, name: "Test User", avatarUrl: null },
      replyTo: null,
      reactions: [],
    })),
  markConversationRead: vi.fn().mockResolvedValue(undefined),
  searchUsers: vi.fn().mockResolvedValue([]),
  getConversationParticipantIds: vi.fn().mockResolvedValue([1, 2]),
  upsertPresence: vi.fn().mockResolvedValue(undefined),
  getPresenceByUserIds: vi.fn().mockResolvedValue([]),
  getUserByEmail: vi.fn().mockResolvedValue(undefined),
  getUserById: vi.fn().mockResolvedValue({
    id: 1,
    openId: "local:test@example.com",
    name: "Test User",
    email: "test@example.com",
    loginMethod: "local",
    role: "user",
    avatarUrl: null,
    passwordHash: null,
    statusMessage: null,
    backgroundUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  }),
  createLocalUser: vi.fn().mockResolvedValue({
    id: 1,
    openId: "local:new@example.com",
    name: "New User",
    email: "new@example.com",
    loginMethod: "local",
    role: "user",
    avatarUrl: null,
    passwordHash: "stored",
    statusMessage: null,
    backgroundUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  }),
  touchLastSignedIn: vi.fn().mockResolvedValue(undefined),
  updateUserProfile: vi.fn().mockResolvedValue(undefined),
  deleteMessage: vi.fn().mockResolvedValue(true),
  toggleReaction: vi.fn().mockResolvedValue({ added: true }),
  getMessageConversationId: vi.fn().mockResolvedValue(1),
  updateConversationSettings: vi.fn().mockResolvedValue(undefined),
  leaveConversation: vi.fn().mockResolvedValue(undefined),
  listFriends: vi.fn().mockResolvedValue([]),
  addFriend: vi.fn().mockResolvedValue({ success: true }),
  updateFriend: vi.fn().mockResolvedValue(undefined),
  removeFriend: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("./socket", () => ({
  emitNewMessage: vi.fn().mockResolvedValue(undefined),
  emitReadReceipt: vi.fn(),
  emitMessageDeleted: vi.fn(),
  emitReactionUpdate: vi.fn(),
  emitConversationDeleted: vi.fn(),
  initSocketIO: vi.fn(),
  getIO: vi.fn(),
  isUserOnline: vi.fn().mockReturnValue(false),
}));

vi.mock("./storage", () => ({
  storagePut: vi
    .fn()
    .mockResolvedValue({ key: "test-key", url: "/uploads/test-key" }),
}));

// Provide JWT secret for auth tests
process.env.JWT_SECRET ||= "test-secret-test-secret-test-secret";

function createCtx(userId: number | null = 1): TrpcContext {
  return {
    user: userId
      ? {
          id: userId,
          openId: "local:test@example.com",
          name: "Test User",
          email: "test@example.com",
          loginMethod: "local",
          role: "user",
          avatarUrl: null,
          passwordHash: null,
          statusMessage: null,
          backgroundUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ── Auth ───────────────────────────────────────────────────────
describe("auth.register", () => {
  it("creates a new account when email is unused", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    const result = await caller.auth.register({
      email: "new@example.com",
      password: "password123",
      name: "New User",
    });
    expect(result.user).toHaveProperty("id");
    expect(result.user.email).toBe("new@example.com");
  });
});

describe("auth.login", () => {
  it("rejects unknown email", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(
      caller.auth.login({ email: "nope@example.com", password: "whatever" })
    ).rejects.toThrow();
  });
});

describe("auth.logout", () => {
  it("clears session cookie", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

describe("auth.me", () => {
  it("returns the current user", async () => {
    const caller = appRouter.createCaller(createCtx());
    const me = await caller.auth.me();
    expect(me?.id).toBe(1);
  });
});

// ── Chat ───────────────────────────────────────────────────────
describe("chat.listConversations", () => {
  it("returns empty array when no conversations", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.chat.listConversations();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("chat.getOrCreateDM", () => {
  it("creates a DM conversation", async () => {
    const caller = appRouter.createCaller(createCtx(1));
    const result = await caller.chat.getOrCreateDM({ targetUserId: 2 });
    expect(result).toHaveProperty("id");
    expect(result?.type).toBe("dm");
  });

  it("throws when trying to DM yourself", async () => {
    const caller = appRouter.createCaller(createCtx(1));
    await expect(caller.chat.getOrCreateDM({ targetUserId: 1 })).rejects.toThrow();
  });
});

describe("chat.createGroup", () => {
  it("creates a group conversation", async () => {
    const caller = appRouter.createCaller(createCtx(1));
    const result = await caller.chat.createGroup({
      name: "Test Group",
      memberIds: [2, 3],
    });
    expect(result).toHaveProperty("id");
    expect(result?.type).toBe("group");
  });
});

describe("chat.sendMessage", () => {
  it("sends a text message", async () => {
    const caller = appRouter.createCaller(createCtx(1));
    const result = await caller.chat.sendMessage({
      conversationId: 1,
      content: "Hello!",
    });
    expect(result.content).toBe("Hello!");
    expect(result.type).toBe("text");
  });

  it("supports reply-to", async () => {
    const caller = appRouter.createCaller(createCtx(1));
    const result = await caller.chat.sendMessage({
      conversationId: 1,
      content: "Replying!",
      replyToId: 5,
    });
    expect(result).toHaveProperty("id");
  });
});

describe("chat.toggleReaction", () => {
  it("toggles a reaction", async () => {
    const caller = appRouter.createCaller(createCtx(1));
    const result = await caller.chat.toggleReaction({
      messageId: 1,
      emoji: "👍",
    });
    expect(result).toHaveProperty("added");
  });
});

describe("chat.deleteMessage", () => {
  it("deletes own message", async () => {
    const caller = appRouter.createCaller(createCtx(1));
    const result = await caller.chat.deleteMessage({ messageId: 1 });
    expect(result.success).toBe(true);
  });
});

describe("chat.updateSettings", () => {
  it("pins a conversation", async () => {
    const caller = appRouter.createCaller(createCtx(1));
    const result = await caller.chat.updateSettings({
      conversationId: 1,
      isPinned: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("chat.markRead", () => {
  it("marks conversation as read", async () => {
    const caller = appRouter.createCaller(createCtx(1));
    const result = await caller.chat.markRead({ conversationId: 1 });
    expect(result.success).toBe(true);
  });
});

describe("chat.searchUsers", () => {
  it("returns user search results", async () => {
    const caller = appRouter.createCaller(createCtx(1));
    const result = await caller.chat.searchUsers({ query: "test" });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Friends ────────────────────────────────────────────────────
describe("friends.list", () => {
  it("returns friend list", async () => {
    const caller = appRouter.createCaller(createCtx(1));
    const result = await caller.friends.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("friends.add", () => {
  it("adds a friend", async () => {
    const caller = appRouter.createCaller(createCtx(1));
    const result = await caller.friends.add({ friendId: 2 });
    expect(result).toHaveProperty("success");
  });
});

// ── Users ──────────────────────────────────────────────────────
describe("users.updateProfile", () => {
  it("updates profile", async () => {
    const caller = appRouter.createCaller(createCtx(1));
    const result = await caller.users.updateProfile({
      name: "New Name",
      statusMessage: "Hello!",
    });
    expect(result.success).toBe(true);
  });
});
