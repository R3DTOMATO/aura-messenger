import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import UserAvatar from "./UserAvatar";
import { Search, Loader2, Users, MessageCircle, Check, X } from "lucide-react";
import { toast } from "sonner";
import BottomSheet from "./BottomSheet";

interface NewChatModalProps {
  onClose: () => void;
  onConversationCreated: (id: number) => void;
}

type Mode = "dm" | "group";

export default function NewChatModal({ onClose, onConversationCreated }: NewChatModalProps) {
  const [mode, setMode] = useState<Mode>("dm");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<
    { id: number; name: string | null; avatarUrl: string | null }[]
  >([]);
  const [groupName, setGroupName] = useState("");

  const { data: results = [], isLoading } = trpc.chat.searchUsers.useQuery(
    { query },
    { enabled: query.trim().length >= 1 }
  );

  const createDM = trpc.chat.getOrCreateDM.useMutation({
    onSuccess: (conv) => conv && onConversationCreated(conv.id),
    onError: (e) => toast.error(e.message),
  });

  const createGroup = trpc.chat.createGroup.useMutation({
    onSuccess: (conv) => conv && onConversationCreated(conv.id),
    onError: (e) => toast.error(e.message),
  });

  const isSelected = (id: number) => selected.some((s) => s.id === id);
  const toggleSelect = (user: { id: number; name: string | null; avatarUrl: string | null }) => {
    setSelected((prev) =>
      isSelected(user.id) ? prev.filter((s) => s.id !== user.id) : [...prev, user]
    );
  };

  const handleCreateGroup = () => {
    if (selected.length < 1) {
      toast.error("최소 1명 이상 선택해주세요");
      return;
    }
    const name =
      groupName.trim() ||
      selected
        .map((s) => s.name)
        .filter(Boolean)
        .slice(0, 3)
        .join(", ") ||
      "그룹 채팅";
    createGroup.mutate({ name, memberIds: selected.map((s) => s.id) });
  };

  const handlePickUser = (user: { id: number; name: string | null; avatarUrl: string | null }) => {
    if (mode === "dm") {
      createDM.mutate({ targetUserId: user.id });
    } else {
      toggleSelect(user);
    }
  };

  return (
    <BottomSheet open onClose={onClose} title="새 대화">
      {/* Tabs */}
      <div
        className="flex p-1 mb-3"
        style={{
          background: "var(--bg-muted)",
          borderRadius: "0.75rem",
        }}
      >
        {(
          [
            { key: "dm", label: "1:1 채팅", icon: <MessageCircle size={14} /> },
            { key: "group", label: "그룹 채팅", icon: <Users size={14} /> },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setMode(t.key);
              setSelected([]);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-bold transition-all"
            style={{
              background: mode === t.key ? "var(--bg-elevated)" : "transparent",
              borderRadius: "0.5rem",
              color: mode === t.key ? "var(--fg)" : "var(--fg-muted)",
              boxShadow: mode === t.key ? "1px 1px 0 var(--border-soft)" : "none",
              border: 0,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            type="button"
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Group name input + selected chips (group mode only) */}
      {mode === "group" && (
        <>
          <input
            type="text"
            placeholder="그룹 이름 (선택)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="memphis-input w-full px-3 py-2 text-sm mb-2"
            maxLength={120}
          />
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {selected.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold"
                  style={{
                    background: "var(--yellow)",
                    border: "1.5px solid var(--border)",
                    borderRadius: "999px",
                    color: "var(--ink)",
                  }}
                >
                  {s.name ?? "?"}
                  <button
                    onClick={() => toggleSelect(s)}
                    style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--ink)", display: "flex" }}
                    aria-label="제거"
                    type="button"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--fg-muted)" }}
        />
        <input
          type="text"
          placeholder="이름 또는 이메일 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="soft-input w-full pl-9 pr-3 py-2.5 text-sm"
          autoFocus
        />
      </div>

      {/* Results */}
      <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--fg-muted)" }} />
          </div>
        )}
        {!isLoading && query && results.length === 0 && (
          <div className="text-center py-6 text-sm" style={{ color: "var(--fg-muted)" }}>
            검색 결과가 없습니다
          </div>
        )}
        {!query && (
          <div className="text-center py-6 text-sm" style={{ color: "var(--fg-muted)" }}>
            사용자 이름이나 이메일을 입력하세요
          </div>
        )}
        {results.map((user) => {
          const checked = isSelected(user.id);
          return (
            <button
              key={user.id}
              onClick={() => handlePickUser(user)}
              disabled={createDM.isPending}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-colors"
              style={{
                background: checked ? "var(--bg-muted)" : "transparent",
                border: 0,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              type="button"
            >
              <UserAvatar
                name={user.name ?? "?"}
                avatarUrl={user.avatarUrl}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{user.name ?? "이름 없음"}</p>
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {user.email ?? ""}
                </p>
              </div>
              {mode === "group" && (
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
              )}
              {mode === "dm" && createDM.isPending && (
                <Loader2 size={14} className="animate-spin flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Group create button */}
      {mode === "group" && (
        <button
          onClick={handleCreateGroup}
          disabled={selected.length < 1 || createGroup.isPending}
          className="memphis-btn w-full mt-3 py-3 font-bold text-sm"
          style={{
            background: selected.length >= 1 ? "var(--ink)" : "var(--gray-200)",
            color: selected.length >= 1 ? "var(--white)" : "var(--fg-muted)",
            borderRadius: "0.875rem",
          }}
          type="button"
        >
          {createGroup.isPending
            ? "생성 중..."
            : `그룹 채팅 만들기${selected.length > 0 ? ` (${selected.length + 1}명)` : ""}`}
        </button>
      )}
    </BottomSheet>
  );
}
