import React, { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import ConversationList from "@/components/ConversationList";
import ChatRoom from "@/components/ChatRoom";
import FriendsList from "@/components/FriendsList";
import ProfileSheet from "@/components/ProfileSheet";
import CallScreen from "@/components/CallScreen";
import UserAvatar from "@/components/UserAvatar";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { useCall, type CallKind } from "@/hooks/useCall";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { MessageCircle, Users as UsersIcon, Settings, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { getSocket } from "@/hooks/useSocket";

type Tab = "chat" | "friends";

export default function MessengerPage() {
  const { user, logout } = useAuth();
  const [selectedConvId, setSelectedConvId] = useState<number | undefined>();
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<Tab>("chat");
  const [showProfile, setShowProfile] = useState(false);
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();

  useSocket(user?.id);

  const callApi = useCall({
    currentUser: user
      ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl }
      : null,
  });

  const utils = trpc.useUtils();
  const createDM = trpc.chat.getOrCreateDM.useMutation({
    onSuccess: (conv) => {
      if (conv) {
        setSelectedConvId(conv.id);
        setTab("chat");
        setMobileView("chat");
        utils.chat.listConversations.invalidate();
      }
    },
  });

  // Request notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Presence + toast notifications via global socket events
  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;

    const handlePresence = ({
      userId,
      isOnline,
    }: {
      userId: number;
      isOnline: boolean;
    }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (isOnline) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    const handleConvUpdated = ({
      conversationId,
      message,
    }: {
      conversationId: number;
      message: {
        sender?: { name?: string | null };
        senderId?: number;
        content?: string | null;
        type?: string;
        fileName?: string | null;
      };
    }) => {
      utils.chat.listConversations.invalidate();
      // Don't show notifications for messages I sent
      if (message?.senderId === user?.id) return;

      // Use functional setState to read current selectedConvId without dep
      setSelectedConvId((current) => {
        if (conversationId === current) return current;

        const senderName = message?.sender?.name ?? "누군가";
        const preview =
          message?.type === "image"
            ? "📷 사진"
            : message?.type === "file"
            ? `📎 ${message?.fileName ?? "파일"}`
            : message?.content ?? "";

        toast(senderName, {
          description: preview,
          duration: 4000,
          action: {
            label: "보기",
            onClick: () => {
              setSelectedConvId(conversationId);
              setTab("chat");
              setMobileView("chat");
            },
          },
        });

        if (
          "Notification" in window &&
          Notification.permission === "granted" &&
          document.hidden
        ) {
          try {
            new Notification(senderName, {
              body: preview,
              icon: "/favicon.ico",
            });
          } catch {
            // ignore
          }
        }
        return current;
      });
    };

    const handleConvLeft = ({ conversationId }: { conversationId: number }) => {
      setSelectedConvId((cur) => (cur === conversationId ? undefined : cur));
      utils.chat.listConversations.invalidate();
    };

    sock.on("presence_update", handlePresence);
    sock.on("conversation_updated", handleConvUpdated);
    sock.on("conversation_left", handleConvLeft);

    return () => {
      sock.off("presence_update", handlePresence);
      sock.off("conversation_updated", handleConvUpdated);
      sock.off("conversation_left", handleConvLeft);
    };
  }, [user?.id, utils.chat.listConversations]);

  const handleSelectConv = useCallback((id: number) => {
    setSelectedConvId(id);
    setMobileView("chat");
  }, []);

  const handleStartDMFromFriend = useCallback(
    (friendId: number) => {
      createDM.mutate({ targetUserId: friendId });
    },
    [createDM]
  );

  const handleBack = useCallback(() => setMobileView("list"), []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      setLocation("/");
    }
  }, [logout, setLocation]);

  if (!user) return null;

  return (
    <div
      className="relative flex overflow-hidden"
      style={{
        background: "var(--bg)",
        height: "100dvh",
        width: "100%",
      }}
    >
      {/* Main container */}
      <div
        className="relative z-10 flex w-full h-full"
        style={{ maxWidth: 1280, margin: "0 auto" }}
      >
        {/* ── Left rail (icons) ── desktop only */}
        <aside
          className="hidden md:flex flex-col items-center gap-2 py-4 px-2 flex-shrink-0"
          style={{
            width: 64,
            background: "var(--bg-elevated)",
            borderRight: "1.5px solid var(--border-soft)",
          }}
        >
          <button
            onClick={() => setShowProfile(true)}
            className="mb-2"
            style={{ background: "transparent", border: 0, cursor: "pointer", padding: 0 }}
            title="내 프로필"
            type="button"
          >
            <UserAvatar
              name={user.name ?? "?"}
              avatarUrl={user.avatarUrl}
              size="md"
            />
          </button>

          <div style={{ height: 1, width: 28, background: "var(--border-soft)", margin: "4px 0" }} />

          <RailButton
            active={tab === "chat"}
            onClick={() => setTab("chat")}
            label="채팅"
            icon={<MessageCircle size={20} />}
          />
          <RailButton
            active={tab === "friends"}
            onClick={() => setTab("friends")}
            label="친구"
            icon={<UsersIcon size={20} />}
          />

          <div className="flex-1" />

          <RailButton
            onClick={toggleTheme}
            label={theme === "dark" ? "라이트 모드" : "다크 모드"}
            icon={theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          />
          <RailButton
            onClick={() => setShowProfile(true)}
            label="설정"
            icon={<Settings size={18} />}
          />
        </aside>

        {/* ── Sidebar (List) ── */}
        <div
          className={`flex-col flex-shrink-0 ${
            mobileView === "chat" ? "hidden md:flex" : "flex"
          }`}
          style={{
            width: "100%",
            maxWidth: 360,
            minWidth: 0,
            borderRight: "1.5px solid var(--border-soft)",
            height: "100%",
          }}
        >
          {tab === "chat" ? (
            <ConversationList
              selectedId={selectedConvId}
              onSelect={handleSelectConv}
              currentUserId={user.id}
              onlineUserIds={onlineUserIds}
            />
          ) : (
            <FriendsList
              currentUserId={user.id}
              onlineUserIds={onlineUserIds}
              onStartChat={handleStartDMFromFriend}
            />
          )}

          {/* Mobile bottom tab bar */}
          <nav
            className="md:hidden flex border-t safe-bottom"
            style={{
              background: "var(--bg-elevated)",
              borderTopColor: "var(--border-soft)",
              borderTopWidth: 1.5,
              borderTopStyle: "solid",
            }}
          >
            <MobileTab
              active={tab === "chat"}
              onClick={() => setTab("chat")}
              icon={<MessageCircle size={20} />}
              label="채팅"
            />
            <MobileTab
              active={tab === "friends"}
              onClick={() => setTab("friends")}
              icon={<UsersIcon size={20} />}
              label="친구"
            />
            <MobileTab
              active={false}
              onClick={() => setShowProfile(true)}
              icon={
                <UserAvatar
                  name={user.name ?? "?"}
                  avatarUrl={user.avatarUrl}
                  size="xs"
                />
              }
              label="내정보"
            />
          </nav>
        </div>

        {/* ── Chat Panel ── */}
        <div
          className={`flex-1 flex-col ${
            mobileView === "list" ? "hidden md:flex" : "flex"
          }`}
          style={{ minWidth: 0, height: "100%" }}
        >
          {selectedConvId ? (
            <ChatRoom
              conversationId={selectedConvId}
              currentUserId={user.id}
              onBack={handleBack}
              onlineUserIds={onlineUserIds}
              onStartCall={(peer, kind) => callApi.startCall(peer, kind)}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      <ProfileSheet
        open={showProfile}
        onClose={() => setShowProfile(false)}
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        }}
        onLogout={handleLogout}
      />

      <CallScreen
        state={callApi.callState}
        localStream={callApi.localStream}
        remoteStream={callApi.remoteStream}
        muted={callApi.muted}
        cameraOff={callApi.cameraOff}
        onAccept={callApi.acceptCall}
        onReject={callApi.rejectCall}
        onEnd={callApi.endCall}
        onToggleMute={callApi.toggleMute}
        onToggleCamera={callApi.toggleCamera}
      />
    </div>
  );
}

function RailButton({
  active,
  onClick,
  label,
  icon,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="icon-btn"
      style={{
        width: 44,
        height: 44,
        background: active ? "var(--yellow)" : "transparent",
        border: active ? "1.5px solid var(--border)" : "1.5px solid transparent",
        color: active ? "var(--ink)" : "var(--fg-soft)",
        borderRadius: 12,
      }}
      type="button"
    >
      {icon}
    </button>
  );
}

function MobileTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
      style={{
        background: "transparent",
        border: 0,
        cursor: "pointer",
        color: active ? "var(--ink)" : "var(--fg-muted)",
        fontFamily: "inherit",
      }}
      type="button"
    >
      <div
        style={{
          color: active ? "var(--coral)" : "var(--fg-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: "0.65rem",
          fontWeight: active ? 800 : 600,
        }}
      >
        {label}
      </span>
    </button>
  );
}

function EmptyState() {
  return (
    <div
      className="hidden md:flex flex-col items-center justify-center h-full gap-3"
      style={{ background: "var(--chat-bg)" }}
    >
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: "50%",
          background: "var(--yellow)",
          border: "2px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "4px 4px 0 var(--border)",
        }}
        className="animate-float"
      >
        <MessageCircle size={40} color="var(--ink)" strokeWidth={2.5} />
      </div>

      <h2
        style={{
          fontFamily: "Space Grotesk, Pretendard, sans-serif",
          fontWeight: 800,
          fontSize: "1.4rem",
          letterSpacing: "-0.02em",
          marginTop: 8,
        }}
      >
        대화를 선택하세요
      </h2>
      <p
        style={{
          color: "var(--fg-muted)",
          fontSize: "0.9rem",
          textAlign: "center",
        }}
      >
        왼쪽에서 대화를 선택하거나
        <br />새 대화를 시작해보세요 ✨
      </p>

      <div className="flex gap-2 mt-2">
        {["var(--mint)", "var(--lilac)", "var(--yellow)"].map((c, i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: c,
              border: "1.5px solid var(--border)",
              animationDelay: `${i * 0.3}s`,
            }}
            className="animate-pulse-dot"
          />
        ))}
      </div>
    </div>
  );
}
