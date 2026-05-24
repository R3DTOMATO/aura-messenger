import React, { useRef, useState } from "react";
import UserAvatar from "./UserAvatar";
import { Download, CheckCheck, Check, Reply, Copy, Trash2, SmilePlus } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";

export type ReplyTo = {
  id: number;
  content: string | null;
  type: string;
  fileName: string | null;
  sender: { id: number; name: string | null; avatarUrl: string | null } | null;
} | null;

export type MessageReaction = { emoji: string; userId: number };

export type MessageData = {
  id: number;
  content?: string | null;
  type: "text" | "image" | "file" | "system";
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileMime?: string | null;
  createdAt: Date | string;
  sender: { id: number; name: string | null; avatarUrl: string | null } | null;
  replyTo?: ReplyTo;
  reactions?: MessageReaction[];
};

interface MessageBubbleProps {
  message: MessageData;
  isMe: boolean;
  showAvatar?: boolean;
  showTime?: boolean;
  isRead?: boolean;
  currentUserId: number;
  onReply?: (msg: MessageData) => void;
  onDelete?: (msg: MessageData) => void;
  onReact?: (msg: MessageData, emoji: string) => void;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export default function MessageBubble({
  message,
  isMe,
  showAvatar = true,
  showTime = true,
  isRead = false,
  currentUserId,
  onReply,
  onDelete,
  onReact,
}: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // System messages render in the middle of the chat
  if (message.type === "system") {
    return (
      <div className="system-msg">
        <span>{message.content}</span>
      </div>
    );
  }

  const timeStr = format(new Date(message.createdAt), "a h:mm", { locale: ko });

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard
        .writeText(message.content)
        .then(() => toast.success("복사되었습니다"))
        .catch(() => toast.error("복사에 실패했습니다"));
    }
    setMenuOpen(false);
  };

  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => {
      setMenuOpen(true);
    }, 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  // Right-click / context menu support for desktop
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(true);
  };

  // ── Reactions aggregation ──
  const reactionGroups = (message.reactions ?? []).reduce<
    Record<string, { count: number; mine: boolean }>
  >((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
    acc[r.emoji].count += 1;
    if (r.userId === currentUserId) acc[r.emoji].mine = true;
    return acc;
  }, {});

  const renderContent = () => {
    if (message.type === "image" && message.fileUrl) {
      return (
        <div style={{ maxWidth: 260 }}>
          <img
            src={message.fileUrl}
            alt={message.fileName ?? "이미지"}
            style={{
              width: "100%",
              borderRadius: "0.75rem",
              display: "block",
              cursor: "pointer",
              maxHeight: 360,
              objectFit: "cover",
            }}
            onClick={() => window.open(message.fileUrl!, "_blank")}
            loading="lazy"
          />
          {message.content && (
            <p className="mt-1.5 text-sm" style={{ opacity: 0.85 }}>
              {message.content}
            </p>
          )}
        </div>
      );
    }

    if (message.type === "file" && message.fileUrl) {
      return (
        <a
          href={message.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 no-underline"
          style={{
            background: isMe ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.04)",
            borderRadius: "0.75rem",
            padding: "0.6rem 0.8rem",
            border: `1.5px solid ${isMe ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.1)"}`,
            minWidth: 180,
            maxWidth: 260,
            color: "inherit",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "0.5rem",
              background: "var(--yellow)",
              border: "1.5px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: "var(--ink)",
            }}
          >
            <Download size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate">{message.fileName ?? "파일"}</p>
            {message.fileSize ? (
              <p className="text-xs" style={{ opacity: 0.65 }}>
                {formatFileSize(message.fileSize)}
              </p>
            ) : null}
          </div>
        </a>
      );
    }

    return (
      <p
        className="text-sm leading-relaxed"
        style={{
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
          maxWidth: 320,
        }}
      >
        {message.content}
      </p>
    );
  };

  const replyBlock = message.replyTo ? (
    <div className="reply-indicator">
      <div className="font-bold" style={{ fontSize: "0.7rem" }}>
        {message.replyTo.sender?.name ?? "이름 없음"}
      </div>
      <div className="line-clamp-1" style={{ fontSize: "0.72rem" }}>
        {message.replyTo.type === "image"
          ? "📷 이미지"
          : message.replyTo.type === "file"
          ? `📎 ${message.replyTo.fileName ?? "파일"}`
          : message.replyTo.content || ""}
      </div>
    </div>
  ) : null;

  const bubble = (
    <div
      ref={bubbleRef}
      className={isMe ? "bubble-me" : "bubble-other"}
      style={{ padding: "8px 12px", position: "relative" }}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
      onTouchMove={cancelLongPress}
      onContextMenu={handleContextMenu}
    >
      {replyBlock}
      {renderContent()}
    </div>
  );

  const reactionRow =
    Object.keys(reactionGroups).length > 0 ? (
      <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
        {Object.entries(reactionGroups).map(([emoji, { count, mine }]) => (
          <button
            key={emoji}
            className={`reaction-chip ${mine ? "mine" : ""}`}
            onClick={() => onReact?.(message, emoji)}
            type="button"
          >
            <span>{emoji}</span>
            <span>{count}</span>
          </button>
        ))}
      </div>
    ) : null;

  const meta = (
    <div className="flex items-center gap-1" style={{ fontSize: "0.65rem", color: "var(--fg-muted)" }}>
      {isMe && (isRead ? (
        <CheckCheck size={12} style={{ color: "var(--mint-dark)" }} />
      ) : (
        <Check size={12} />
      ))}
      <span>{timeStr}</span>
    </div>
  );

  // Long-press / context menu sheet
  const menu = menuOpen ? (
    <div
      className="bottom-sheet"
      onClick={(e) => e.target === e.currentTarget && setMenuOpen(false)}
    >
      <div className="bottom-sheet-panel" style={{ maxWidth: 400 }}>
        <div
          aria-hidden
          style={{
            width: 38,
            height: 4,
            background: "var(--gray-300)",
            borderRadius: 2,
            margin: "2px auto 12px",
          }}
        />
        {/* Quick reactions */}
        <div className="flex items-center justify-around mb-2 px-2">
          {QUICK_REACTIONS.map((e) => {
            const mine = reactionGroups[e]?.mine;
            return (
              <button
                key={e}
                className="text-2xl transition-transform"
                style={{
                  background: mine ? "var(--yellow)" : "transparent",
                  borderRadius: "50%",
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: 0,
                  cursor: "pointer",
                }}
                onClick={() => {
                  onReact?.(message, e);
                  setMenuOpen(false);
                }}
                type="button"
              >
                {e}
              </button>
            );
          })}
        </div>
        <div style={{ height: 1, background: "var(--border-soft)", margin: "8px 0" }} />
        <button
          className="sheet-item"
          onClick={() => {
            onReply?.(message);
            setMenuOpen(false);
          }}
          type="button"
        >
          <Reply size={18} /> 답장
        </button>
        {message.type === "text" && (
          <button className="sheet-item" onClick={handleCopy} type="button">
            <Copy size={18} /> 복사
          </button>
        )}
        {isMe && (
          <button
            className="sheet-item destructive"
            onClick={() => {
              onDelete?.(message);
              setMenuOpen(false);
            }}
            type="button"
          >
            <Trash2 size={18} /> 삭제
          </button>
        )}
      </div>
    </div>
  ) : null;

  if (isMe) {
    return (
      <>
        <div className="flex justify-end items-end gap-2 mb-1 animate-msg-in-right" style={{ paddingLeft: 40 }}>
          <div className="flex flex-col items-end gap-0.5 max-w-full">
            <div className="flex items-end gap-1.5">
              {showTime && meta}
              {bubble}
            </div>
            {reactionRow}
          </div>
        </div>
        {menu}
      </>
    );
  }

  return (
    <>
      <div className="flex items-end gap-2 mb-1 animate-msg-in-left" style={{ paddingRight: 40 }}>
        {showAvatar ? (
          <UserAvatar
            name={message.sender?.name ?? "?"}
            avatarUrl={message.sender?.avatarUrl}
            size="sm"
            className="mb-1"
          />
        ) : (
          <div style={{ width: 30, flexShrink: 0 }} />
        )}
        <div className="flex flex-col gap-0.5 min-w-0">
          {showAvatar && message.sender?.name && (
            <span
              className="text-xs font-bold ml-1"
              style={{ color: "var(--fg-soft)" }}
            >
              {message.sender.name}
            </span>
          )}
          <div className="flex items-end gap-1.5">
            {bubble}
            {showTime && meta}
          </div>
          {reactionRow}
        </div>
      </div>
      {menu}
    </>
  );
}
