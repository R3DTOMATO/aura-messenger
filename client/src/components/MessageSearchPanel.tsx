import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import UserAvatar from "./UserAvatar";
import { Search, X, Loader2, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface MessageSearchPanelProps {
  conversationId: number;
  onClose: () => void;
  onJumpToMessage: (messageId: number) => void;
}

export default function MessageSearchPanel({
  conversationId,
  onClose,
  onJumpToMessage,
}: MessageSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [], isLoading } = trpc.messages.search.useQuery(
    { conversationId, query: debouncedQuery },
    { enabled: debouncedQuery.length >= 1 }
  );

  const highlight = (text: string, q: string) => {
    if (!q) return text;
    const lower = text.toLowerCase();
    const lowerQ = q.toLowerCase();
    const idx = lower.indexOf(lowerQ);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark
          style={{
            background: "var(--yellow)",
            color: "var(--ink)",
            padding: "0 2px",
            borderRadius: 3,
          }}
        >
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div
      className="absolute top-0 left-0 right-0 z-30 flex flex-col animate-slide-down"
      style={{
        background: "var(--bg-elevated)",
        borderBottom: "1.5px solid var(--border)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        maxHeight: "70vh",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--fg-muted)" }}
          />
          <input
            type="text"
            placeholder="메시지 검색..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="soft-input w-full pl-9 pr-3 py-2 text-sm"
            style={{ fontSize: "0.85rem" }}
          />
        </div>
        <button
          onClick={onClose}
          className="icon-btn"
          aria-label="검색 닫기"
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      {/* Results */}
      <div className="overflow-y-auto" style={{ maxHeight: "60vh" }}>
        {!debouncedQuery && (
          <div className="text-center py-6 text-sm" style={{ color: "var(--fg-muted)" }}>
            검색어를 입력하세요
          </div>
        )}
        {debouncedQuery && isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 size={18} className="animate-spin" style={{ color: "var(--fg-muted)" }} />
          </div>
        )}
        {debouncedQuery && !isLoading && results.length === 0 && (
          <div className="text-center py-6 text-sm" style={{ color: "var(--fg-muted)" }}>
            검색 결과가 없습니다
          </div>
        )}
        {results.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              onJumpToMessage(m.id);
              onClose();
            }}
            className="w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors"
            style={{
              background: "transparent",
              border: 0,
              cursor: "pointer",
              borderBottom: "1px solid var(--border-soft)",
              fontFamily: "inherit",
            }}
            type="button"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <UserAvatar
              name={m.sender?.name ?? "?"}
              avatarUrl={m.sender?.avatarUrl}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-xs">{m.sender?.name ?? "이름 없음"}</span>
                <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  {format(new Date(m.createdAt), "M월 d일 a h:mm", { locale: ko })}
                </span>
              </div>
              <p className="text-sm mt-0.5 line-clamp-2" style={{ color: "var(--fg-soft)" }}>
                {highlight(m.content ?? "", debouncedQuery)}
              </p>
            </div>
            <ArrowDown
              size={14}
              style={{ color: "var(--fg-muted)", flexShrink: 0, marginTop: 4 }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
