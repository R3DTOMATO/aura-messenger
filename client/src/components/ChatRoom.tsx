import React, { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import MessageBubble, { MessageData } from "./MessageBubble";
import MessageInput from "./MessageInput";
import UserAvatar from "./UserAvatar";
import BottomSheet from "./BottomSheet";
import {
  ArrowLeft,
  MoreVertical,
  Phone,
  Video,
  Pin,
  PinOff,
  Bell,
  BellOff,
  LogOut as LeaveIcon,
  Users,
} from "lucide-react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import { getSocket } from "@/hooks/useSocket";

interface ChatRoomProps {
  conversationId: number;
  currentUserId: number;
  onBack?: () => void;
  onlineUserIds: Set<number>;
}

type ConvDetail = {
  id: number;
  type: "dm" | "group";
  name: string | null;
  customName: string | null;
  avatarUrl: string | null;
  memberCount: number;
  isPinned: boolean;
  isMuted: boolean;
  participants: { id: number; name: string | null; avatarUrl: string | null }[];
};

function getDateLabel(date: Date) {
  if (isToday(date)) return "오늘";
  if (isYesterday(date)) return "어제";
  return format(date, "yyyy년 M월 d일 (EEEE)", { locale: ko });
}

export default function ChatRoom({
  conversationId,
  currentUserId,
  onBack,
  onlineUserIds,
}: ChatRoomProps) {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const [readByOther, setReadByOther] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstLoadRef = useRef(true);

  const utils = trpc.useUtils();

  const { data: fetchedMessages = [], isLoading } = trpc.chat.getMessages.useQuery(
    { conversationId },
    { refetchOnWindowFocus: false }
  );

  const markRead = trpc.chat.markRead.useMutation();
  const deleteMsg = trpc.chat.deleteMessage.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const toggleReaction = trpc.chat.toggleReaction.useMutation();
  const updateSettings = trpc.chat.updateSettings.useMutation({
    onSuccess: () => utils.chat.listConversations.invalidate(),
  });
  const leave = trpc.chat.leave.useMutation({
    onSuccess: () => {
      toast.success("채팅방에서 나갔습니다");
      utils.chat.listConversations.invalidate();
      onBack?.();
    },
  });

  // Get conversation info from conversation list
  const { data: conversations = [] } = trpc.chat.listConversations.useQuery() as {
    data: ConvDetail[];
  };
  const conv = conversations.find((c) => c.id === conversationId);
  const otherUser = conv?.participants?.[0];
  const isOnline = otherUser ? onlineUserIds.has(otherUser.id) : false;

  // Load messages
  useEffect(() => {
    setMessages(fetchedMessages as MessageData[]);
    if (isFirstLoadRef.current && fetchedMessages.length > 0) {
      isFirstLoadRef.current = false;
      requestAnimationFrame(() => scrollToBottom("instant"));
    }
  }, [fetchedMessages]);

  // Reset on conversation change
  useEffect(() => {
    isFirstLoadRef.current = true;
    setReplyTo(null);
    setReadByOther(false);
    setTypingUsers(new Set());
  }, [conversationId]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit("join_conversation", conversationId);

    const handleNewMessage = (msg: MessageData & { conversationId: number }) => {
      if (msg.conversationId !== conversationId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      requestAnimationFrame(() => scrollToBottom("smooth"));

      if (document.hasFocus() && msg.sender?.id !== currentUserId) {
        markRead.mutate({ conversationId });
      }
    };

    const handleTyping = ({ userId, isTyping }: { userId: number; isTyping: boolean }) => {
      if (userId === currentUserId) return;
      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (isTyping) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    const handleReadReceipt = ({
      conversationId: cid,
      userId,
    }: {
      conversationId: number;
      userId: number;
    }) => {
      if (cid === conversationId && userId !== currentUserId) setReadByOther(true);
    };

    const handleMessageDeleted = ({
      conversationId: cid,
      messageId,
    }: {
      conversationId: number;
      messageId: number;
    }) => {
      if (cid !== conversationId) return;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    };

    const handleReactionUpdate = ({
      messageId,
      userId,
      emoji,
      added,
    }: {
      messageId: number;
      userId: number;
      emoji: string;
      added: boolean;
    }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const reactions = m.reactions ?? [];
          if (added) {
            if (reactions.some((r) => r.userId === userId && r.emoji === emoji)) return m;
            return { ...m, reactions: [...reactions, { userId, emoji }] };
          }
          return {
            ...m,
            reactions: reactions.filter(
              (r) => !(r.userId === userId && r.emoji === emoji)
            ),
          };
        })
      );
    };

    socket.on("new_message", handleNewMessage);
    socket.on("typing", handleTyping);
    socket.on("read_receipt", handleReadReceipt);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("reaction_update", handleReactionUpdate);

    markRead.mutate({ conversationId });
    utils.chat.listConversations.invalidate();

    return () => {
      socket.emit("leave_conversation", conversationId);
      socket.off("new_message", handleNewMessage);
      socket.off("typing", handleTyping);
      socket.off("read_receipt", handleReadReceipt);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("reaction_update", handleReactionUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUserId]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      getSocket()?.emit("typing", { conversationId, isTyping });
    },
    [conversationId]
  );

  const handleMessageSent = () => {
    utils.chat.listConversations.invalidate();
    requestAnimationFrame(() => scrollToBottom("smooth"));
  };

  const handleReply = (msg: MessageData) => {
    setReplyTo(msg);
  };

  const handleDelete = (msg: MessageData) => {
    if (confirm("이 메시지를 삭제하시겠습니까?")) {
      deleteMsg.mutate({ messageId: msg.id });
    }
  };

  const handleReact = (msg: MessageData, emoji: string) => {
    toggleReaction.mutate({ messageId: msg.id, emoji });
  };

  // Group messages by date + sender clustering
  const groupedByDate = messages.reduce<{ date: Date; msgs: MessageData[] }[]>(
    (acc, msg) => {
      const d = new Date(msg.createdAt);
      const last = acc[acc.length - 1];
      if (!last || !isSameDay(last.date, d)) acc.push({ date: d, msgs: [msg] });
      else last.msgs.push(msg);
      return acc;
    },
    []
  );

  const displayName = conv?.customName ?? conv?.name ?? otherUser?.name ?? "대화";
  const subtitle =
    typingUsers.size > 0
      ? "입력 중..."
      : conv?.type === "group"
      ? `멤버 ${conv.memberCount}명`
      : isOnline
      ? "온라인"
      : "오프라인";

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: "var(--chat-bg)" }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{
          background: "var(--bg-elevated)",
          borderBottom: "1.5px solid var(--border-soft)",
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="icon-btn md:hidden"
            aria-label="뒤로가기"
            type="button"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        {conv?.type === "group" ? (
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "32%",
              background: "var(--lilac)",
              border: "1.5px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink)",
              flexShrink: 0,
            }}
          >
            <Users size={16} />
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

        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-sm md:text-base truncate">{displayName}</h2>
          <p
            className="text-xs"
            style={{
              color: typingUsers.size > 0 ? "var(--mint-dark)" : "var(--fg-muted)",
              fontWeight: typingUsers.size > 0 ? 700 : 400,
            }}
          >
            {subtitle}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="icon-btn"
            onClick={() => toast.info("음성통화 기능은 준비 중입니다")}
            title="음성통화"
            aria-label="음성통화"
            type="button"
          >
            <Phone size={18} />
          </button>
          <button
            className="icon-btn"
            onClick={() => toast.info("영상통화 기능은 준비 중입니다")}
            title="영상통화"
            aria-label="영상통화"
            type="button"
          >
            <Video size={18} />
          </button>
          <button
            className="icon-btn"
            onClick={() => setShowSettings(true)}
            title="더보기"
            aria-label="더보기"
            type="button"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 py-3 min-h-0"
      >
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="typing-dot"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "var(--lilac)",
                    border: "1.5px solid var(--border)",
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--yellow)",
                border: "1.5px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.8rem",
              }}
            >
              👋
            </div>
            <p className="font-bold text-center">대화를 시작해보세요!</p>
            <p className="text-sm text-center" style={{ color: "var(--fg-muted)" }}>
              {displayName}님에게 첫 메시지를 보내보세요
            </p>
          </div>
        ) : (
          <>
            {groupedByDate.map(({ date, msgs }) => (
              <div key={date.toISOString()}>
                <div className="date-divider">
                  <span>{getDateLabel(date)}</span>
                </div>
                {msgs.map((msg, idx) => {
                  const prevMsg = idx > 0 ? msgs[idx - 1] : null;
                  const nextMsg = idx < msgs.length - 1 ? msgs[idx + 1] : null;
                  const isMe = msg.sender?.id === currentUserId;
                  const showAvatar =
                    !isMe && (!prevMsg || prevMsg.sender?.id !== msg.sender?.id);
                  // Show time on the last consecutive message from same sender
                  const showTime =
                    !nextMsg ||
                    nextMsg.sender?.id !== msg.sender?.id ||
                    // also show if minute changes
                    new Date(nextMsg.createdAt).getMinutes() !==
                      new Date(msg.createdAt).getMinutes();
                  const isLastFromMe =
                    isMe &&
                    (idx === msgs.length - 1 ||
                      msgs[idx + 1]?.sender?.id !== currentUserId);

                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isMe={isMe}
                      showAvatar={showAvatar}
                      showTime={showTime}
                      isRead={isLastFromMe && readByOther}
                      currentUserId={currentUserId}
                      onReply={handleReply}
                      onDelete={handleDelete}
                      onReact={handleReact}
                    />
                  );
                })}
              </div>
            ))}

            {/* Typing indicator */}
            {typingUsers.size > 0 && (
              <div
                className="flex items-end gap-2 mb-1 animate-msg-in-left"
                style={{ paddingRight: 40 }}
              >
                <UserAvatar
                  name={otherUser?.name ?? "?"}
                  avatarUrl={otherUser?.avatarUrl}
                  size="sm"
                />
                <div
                  className="bubble-other flex gap-1.5 items-center"
                  style={{ padding: "10px 14px", minWidth: 56 }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="typing-dot"
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "var(--fg-muted)",
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-1 flex-shrink-0 safe-bottom">
        <MessageInput
          conversationId={conversationId}
          onMessageSent={handleMessageSent}
          onTyping={handleTyping}
          replyTo={
            replyTo
              ? {
                  id: replyTo.id,
                  content: replyTo.content ?? null,
                  type: replyTo.type,
                  fileName: replyTo.fileName ?? null,
                  sender: replyTo.sender
                    ? { name: replyTo.sender.name }
                    : null,
                }
              : null
          }
          onCancelReply={() => setReplyTo(null)}
        />
      </div>

      {/* Settings sheet */}
      <BottomSheet
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="채팅방 메뉴"
      >
        {conv && (
          <>
            <button
              className="sheet-item"
              onClick={() => {
                updateSettings.mutate({
                  conversationId,
                  isPinned: !conv.isPinned,
                });
                setShowSettings(false);
              }}
              type="button"
            >
              {conv.isPinned ? <PinOff size={18} /> : <Pin size={18} />}
              {conv.isPinned ? "상단 고정 해제" : "상단 고정"}
            </button>
            <button
              className="sheet-item"
              onClick={() => {
                updateSettings.mutate({
                  conversationId,
                  isMuted: !conv.isMuted,
                });
                setShowSettings(false);
              }}
              type="button"
            >
              {conv.isMuted ? <Bell size={18} /> : <BellOff size={18} />}
              {conv.isMuted ? "알림 켜기" : "알림 끄기"}
            </button>
            <button
              className="sheet-item destructive"
              onClick={() => {
                if (confirm("정말 이 채팅방에서 나가시겠습니까?")) {
                  leave.mutate({ conversationId });
                  setShowSettings(false);
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
