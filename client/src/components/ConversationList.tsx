import React, { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import UserAvatar from "./UserAvatar";
import {
  Search,
  Plus,
  MessageCircle,
  Pin,
  BellOff,
  Users,
  LogOut as LeaveIcon,
  PinOff,
  Bell,
} from "lucide-react";
import { formatDistanceToNow, isToday, format } from "date-fns";
import { ko } from "date-fns/locale";
import NewChatModal from "./NewChatModal";
import BottomSheet from "./BottomSheet";
import { toast } from "sonner";

interface ConversationListProps {
  selectedId?: number;
  onSelect: (id: number) => void;
  currentUserId: number;
  onlineUserIds: Set<number>;
}

type Conv = {
  id: number;
  type: "dm" | "group";
  name: string | null;
  customName?: string | null;
  avatarUrl?: string | null;
  isPinned: boolean;
  isMuted: boolean;
  unreadCount: number;
  memberCount: number;
  updatedAt: string | Date;
  lastMessage:
    | {
        type: "text" | "image" | "file" | "system";
        content: string | null;
        fileName?: string | null;
        createdAt: string | Date;
        senderId: number;
      }
    | null;
  participants: { id: number; name: string | null; avatarUrl: string | null }[];
};

function formatTime(date: Date) {
  if (isToday(date)) return format(date, "a h:mm", { locale: ko });
  return formatDistanceToNow(date, { addSuffix: false, locale: ko });
}

export default function ConversationList({
  selectedId,
  onSelect,
  currentUserId,
  onlineUserIds,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [menuConv, setMenuConv] = useState<Conv | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const utils = trpc.useUtils();

  const { data: conversations = [], refetch } = trpc.chat.listConversations.useQuery(undefined, {
    refetchInterval: 10000,
  }) as { data: Conv[]; refetch: () => void };

  const updateSettings = trpc.chat.updateSettings.useMutation({
    onSuccess: () => utils.chat.listConversations.invalidate(),
  });

  const leaveConv = trpc.chat.leave.useMutation({
    onSuccess: () => {
      toast.success("대화방에서 나갔습니다");
      utils.chat.listConversations.invalidate();
    },
  });

  const getDisplayName = (conv: Conv) => {
    if (conv.customName) return conv.customName;
    if (conv.type === "group") {
      if (conv.name) return conv.name;
      const names = conv.participants.map((p) => p.name).filter(Boolean).slice(0, 3);
      return names.length > 0 ? names.join(", ") : "그룹 채팅";
    }
    return conv.participants[0]?.name ?? "이름 없음";
  };

  const filtered = conversations.filter((c) => {
    const name = getDisplayName(c);
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const getLastMessagePreview = (conv: Conv) => {
    const msg = conv.lastMessage;
    if (!msg) return "대화를 시작해보세요";
    if (msg.type === "system") return msg.content ?? "";
    if (msg.type === "image") return "📷 사진";
    if (msg.type === "file") return `📎 ${msg.fileName ?? "파일"}`;
    return msg.content ?? "";
  };

  const startLongPress = (conv: Conv) => {
    longPressTimer.current = setTimeout(() => setMenuConv(conv), 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleContext = (e: React.MouseEvent, conv: Conv) => {
    e.preventDefault();
    setMenuConv(conv);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-elevated)" }}>
      {/* Header */}
      <div
        className="px-4 pt-4 pb-3 flex-shrink-0"
        style={{ borderBottom: "1.5px solid var(--border-soft)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h1
            className="font-display"
            style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}
          >
            채팅
          </h1>
          <button
            onClick={() => setShowNewChat(true)}
            className="icon-btn"
            style={{
              width: 36,
              height: 36,
              background: "var(--yellow)",
              border: "1.5px solid var(--border)",
              borderRadius: 12,
              boxShadow: "2px 2px 0 var(--border)",
            }}
            title="새 대화"
            aria-label="새 대화"
            type="button"
          >
            <Plus size={18} color="var(--ink)" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--fg-muted)" }}
          />
          <input
            type="text"
            placeholder="채팅방 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="soft-input w-full pl-9 pr-3 py-2 text-sm"
            style={{ fontSize: "0.85rem", height: 36 }}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--yellow)",
                border: "2px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MessageCircle size={24} color="var(--ink)" />
            </div>
            <p className="text-sm font-bold text-center" style={{ color: "var(--fg-soft)" }}>
              {search ? "검색 결과 없음" : "아직 대화가 없어요"}
            </p>
            {!search && (
              <button
                onClick={() => setShowNewChat(true)}
                className="memphis-btn px-4 py-2 text-sm font-bold"
                style={{
                  background: "var(--yellow)",
                  borderRadius: "0.75rem",
                  color: "var(--ink)",
                }}
                type="button"
              >
                새 대화 시작하기
              </button>
            )}
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = conv.id === selectedId;
            const otherUser = conv.participants[0];
            const isOnline = otherUser ? onlineUserIds.has(otherUser.id) : false;
            const displayName = getDisplayName(conv);
            const preview = getLastMessagePreview(conv);
            const lastDate = conv.lastMessage ? new Date(conv.lastMessage.createdAt) : null;
            const timeStr = lastDate ? formatTime(lastDate) : "";

            return (
              <div
                key={conv.id}
                className={`conv-item ${isActive ? "active" : ""} flex items-center gap-3 px-3 py-2.5 mb-0.5`}
                onClick={() => onSelect(conv.id)}
                onContextMenu={(e) => handleContext(e, conv)}
                onTouchStart={() => startLongPress(conv)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                onTouchCancel={cancelLongPress}
                role="button"
                tabIndex={0}
              >
                <div className="relative flex-shrink-0">
                  {conv.type === "group" ? (
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "32%",
                        background: "var(--lilac)",
                        border: "2px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--ink)",
                      }}
                    >
                      <Users size={18} />
                    </div>
                  ) : (
                    <UserAvatar
                      name={displayName}
                      avatarUrl={otherUser?.avatarUrl}
                      size="md"
                      isOnline={isOnline}
                      showStatus
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-sm truncate">{displayName}</span>
                      {conv.type === "group" && (
                        <span
                          className="flex-shrink-0"
                          style={{
                            fontSize: "0.7rem",
                            color: isActive ? "rgba(255,255,255,0.6)" : "var(--fg-muted)",
                          }}
                        >
                          {conv.memberCount}
                        </span>
                      )}
                      {conv.isMuted && (
                        <BellOff
                          size={12}
                          style={{ color: isActive ? "rgba(255,255,255,0.6)" : "var(--fg-muted)", flexShrink: 0 }}
                        />
                      )}
                    </div>
                    <span
                      className="text-xs flex-shrink-0"
                      style={{
                        color: isActive ? "rgba(255,255,255,0.7)" : "var(--fg-muted)",
                        fontSize: "0.7rem",
                      }}
                    >
                      {timeStr}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5 gap-2">
                    <p
                      className="text-xs truncate flex-1 min-w-0"
                      style={{
                        color: isActive ? "rgba(255,255,255,0.75)" : "var(--fg-soft)",
                        fontWeight: conv.unreadCount > 0 && !conv.isMuted ? 700 : 400,
                      }}
                    >
                      {preview}
                    </p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {conv.isPinned && (
                        <Pin
                          size={11}
                          style={{
                            color: isActive ? "rgba(255,255,255,0.7)" : "var(--coral)",
                          }}
                          fill="currentColor"
                        />
                      )}
                      {conv.unreadCount > 0 && (
                        <span
                          className="unread-badge"
                          style={
                            conv.isMuted
                              ? { background: "var(--gray-400)" }
                              : undefined
                          }
                        >
                          {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onConversationCreated={(id) => {
            onSelect(id);
            setShowNewChat(false);
            refetch();
          }}
        />
      )}

      {/* Conversation action sheet */}
      <BottomSheet
        open={!!menuConv}
        onClose={() => setMenuConv(null)}
        title={menuConv ? getDisplayName(menuConv) : ""}
      >
        {menuConv && (
          <>
            <button
              className="sheet-item"
              onClick={() => {
                updateSettings.mutate({
                  conversationId: menuConv.id,
                  isPinned: !menuConv.isPinned,
                });
                setMenuConv(null);
              }}
              type="button"
            >
              {menuConv.isPinned ? <PinOff size={18} /> : <Pin size={18} />}
              {menuConv.isPinned ? "고정 해제" : "상단 고정"}
            </button>
            <button
              className="sheet-item"
              onClick={() => {
                updateSettings.mutate({
                  conversationId: menuConv.id,
                  isMuted: !menuConv.isMuted,
                });
                setMenuConv(null);
              }}
              type="button"
            >
              {menuConv.isMuted ? <Bell size={18} /> : <BellOff size={18} />}
              {menuConv.isMuted ? "알림 켜기" : "알림 끄기"}
            </button>
            <button
              className="sheet-item destructive"
              onClick={() => {
                if (confirm("정말 이 채팅방에서 나가시겠습니까?")) {
                  leaveConv.mutate({ conversationId: menuConv.id });
                  setMenuConv(null);
                }
              }}
              type="button"
            >
              <LeaveIcon size={18} /> 채팅방 나가기
            </button>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
