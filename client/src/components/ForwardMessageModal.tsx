import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import UserAvatar from "./UserAvatar";
import BottomSheet from "./BottomSheet";
import { Search, Check, Send, Users } from "lucide-react";
import { toast } from "sonner";

interface ForwardMessageModalProps {
  sourceMessageId: number;
  sourceMessagePreview: string;
  onClose: () => void;
}

type Conv = {
  id: number;
  type: "dm" | "group";
  name: string | null;
  customName?: string | null;
  participants: { id: number; name: string | null; avatarUrl: string | null }[];
};

export default function ForwardMessageModal({
  sourceMessageId,
  sourceMessagePreview,
  onClose,
}: ForwardMessageModalProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: conversations = [] } = trpc.chat.listConversations.useQuery() as {
    data: Conv[];
  };

  const forwardMut = trpc.messages.forward.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.forwardedCount}개 채팅방에 전달되었습니다`);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const getDisplayName = (conv: Conv) => {
    if (conv.customName) return conv.customName;
    if (conv.type === "group") {
      if (conv.name) return conv.name;
      return conv.participants.map((p) => p.name).filter(Boolean).slice(0, 3).join(", ") || "그룹";
    }
    return conv.participants[0]?.name ?? "이름 없음";
  };

  const filtered = conversations.filter((c) =>
    getDisplayName(c).toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 10) next.add(id);
      else toast.error("한 번에 최대 10개 채팅방까지 전달 가능");
      return next;
    });
  };

  const handleForward = () => {
    if (selected.size === 0) {
      toast.error("전달할 채팅방을 선택해주세요");
      return;
    }
    forwardMut.mutate({
      sourceMessageId,
      targetConversationIds: Array.from(selected),
    });
  };

  return (
    <BottomSheet open onClose={onClose} title="메시지 전달">
      {/* Preview */}
      <div
        className="mb-3 px-3 py-2"
        style={{
          background: "var(--bg-muted)",
          borderRadius: "0.75rem",
          fontSize: "0.85rem",
          color: "var(--fg-soft)",
        }}
      >
        <div
          className="text-xs font-bold mb-1"
          style={{ color: "var(--fg-muted)" }}
        >
          전달할 메시지
        </div>
        <p className="line-clamp-2">{sourceMessagePreview}</p>
      </div>

      {/* Search */}
      <div className="relative mb-3">
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
        />
      </div>

      {/* List */}
      <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
        {filtered.length === 0 ? (
          <div className="text-center py-6 text-sm" style={{ color: "var(--fg-muted)" }}>
            채팅방이 없습니다
          </div>
        ) : (
          filtered.map((conv) => {
            const checked = selected.has(conv.id);
            const name = getDisplayName(conv);
            return (
              <button
                key={conv.id}
                onClick={() => toggle(conv.id)}
                className="w-full flex items-center gap-3 px-2 py-2 text-left rounded-xl transition-colors"
                style={{
                  background: checked ? "var(--bg-muted)" : "transparent",
                  border: 0,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
                type="button"
              >
                {conv.type === "group" ? (
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
                    name={name}
                    avatarUrl={conv.participants[0]?.avatarUrl}
                    size="md"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{name}</p>
                </div>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: "1.5px solid var(--border)",
                    background: checked ? "var(--ink)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "var(--white)",
                  }}
                >
                  {checked && <Check size={14} />}
                </div>
              </button>
            );
          })
        )}
      </div>

      <button
        onClick={handleForward}
        disabled={selected.size === 0 || forwardMut.isPending}
        className="memphis-btn w-full mt-3 py-3 font-bold text-sm flex items-center justify-center gap-1.5"
        style={{
          background: selected.size > 0 ? "var(--ink)" : "var(--gray-200)",
          color: selected.size > 0 ? "var(--white)" : "var(--fg-muted)",
          borderRadius: "0.875rem",
        }}
        type="button"
      >
        <Send size={14} />
        {forwardMut.isPending ? "전달 중..." : `전달 (${selected.size})`}
      </button>
    </BottomSheet>
  );
}
