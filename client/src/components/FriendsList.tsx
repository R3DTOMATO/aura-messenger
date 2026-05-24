import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import UserAvatar from "./UserAvatar";
import BottomSheet from "./BottomSheet";
import {
  Search,
  Star,
  StarOff,
  UserPlus,
  MessageCircle,
  EyeOff,
  Eye,
  Ban,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface FriendsListProps {
  currentUserId: number;
  onlineUserIds: Set<number>;
  onStartChat: (userId: number) => void;
}

export default function FriendsList({
  currentUserId,
  onlineUserIds,
  onStartChat,
}: FriendsListProps) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const utils = trpc.useUtils();
  const { data: friends = [] } = trpc.friends.list.useQuery();

  const updateFriend = trpc.friends.update.useMutation({
    onSuccess: () => utils.friends.list.invalidate(),
  });

  const visible = friends.filter((f) => {
    if (!showHidden && f.isHidden) return false;
    if (f.isBlocked) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (f.name ?? "").toLowerCase().includes(q) ||
      (f.email ?? "").toLowerCase().includes(q) ||
      (f.nickname ?? "").toLowerCase().includes(q)
    );
  });

  // Sort: favorite first, then alphabetical
  const sorted = [...visible].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  const favCount = friends.filter((f) => f.isFavorite && !f.isBlocked).length;
  const totalCount = friends.filter((f) => !f.isHidden && !f.isBlocked).length;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-elevated)" }}>
      {/* Search */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--fg-muted)" }}
          />
          <input
            type="text"
            placeholder="친구 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="soft-input w-full pl-9 pr-3 py-2.5 text-sm"
          />
        </div>
        <div
          className="flex items-center justify-between mt-2 px-1 text-xs"
          style={{ color: "var(--fg-muted)" }}
        >
          <span>친구 {totalCount}명 {favCount > 0 && `· ⭐ ${favCount}`}</span>
          <button
            onClick={() => setShowHidden((v) => !v)}
            className="font-bold"
            style={{
              background: "transparent",
              border: 0,
              cursor: "pointer",
              color: "var(--fg-muted)",
            }}
            type="button"
          >
            {showHidden ? "숨김 친구 숨기기" : "숨김 친구 보기"}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12 px-4 text-center">
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "var(--mint)",
                border: "2px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "3px 3px 0 var(--border)",
              }}
            >
              <UserPlus size={24} color="var(--ink)" />
            </div>
            <p className="text-sm font-bold" style={{ color: "var(--fg-soft)" }}>
              {search ? "검색 결과가 없어요" : "아직 친구가 없어요"}
            </p>
            {!search && (
              <button
                onClick={() => setShowAdd(true)}
                className="memphis-btn px-4 py-2 text-sm font-bold mt-1"
                style={{
                  background: "var(--mint)",
                  color: "var(--ink)",
                  borderRadius: "0.75rem",
                }}
                type="button"
              >
                친구 추가하기
              </button>
            )}
          </div>
        ) : (
          sorted.map((f) => {
            const isOnline = onlineUserIds.has(f.friendId);
            return (
              <div
                key={f.friendId}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{
                  transition: "background 0.12s ease",
                  cursor: "default",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-muted)")
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <UserAvatar
                  name={f.nickname ?? f.name ?? "?"}
                  avatarUrl={f.avatarUrl}
                  size="md"
                  isOnline={isOnline}
                  showStatus
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-bold text-sm truncate">
                      {f.nickname ?? f.name ?? "이름 없음"}
                    </p>
                    {f.isFavorite && (
                      <Star size={12} fill="var(--yellow-dark)" color="var(--yellow-dark)" />
                    )}
                  </div>
                  <p
                    className="text-xs truncate"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    {f.statusMessage ?? f.email ?? ""}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() =>
                      updateFriend.mutate({
                        friendId: f.friendId,
                        isFavorite: !f.isFavorite,
                      })
                    }
                    className="icon-btn"
                    style={{ width: 32, height: 32 }}
                    title={f.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
                    type="button"
                    aria-label="즐겨찾기"
                  >
                    {f.isFavorite ? (
                      <Star size={15} fill="var(--yellow-dark)" color="var(--yellow-dark)" />
                    ) : (
                      <StarOff size={15} />
                    )}
                  </button>
                  <button
                    onClick={() => onStartChat(f.friendId)}
                    className="icon-btn"
                    style={{ width: 32, height: 32 }}
                    title="채팅"
                    type="button"
                    aria-label="채팅 시작"
                  >
                    <MessageCircle size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FAB - add friend */}
      <button
        onClick={() => setShowAdd(true)}
        className="memphis-btn absolute flex items-center justify-center"
        style={{
          bottom: 18,
          right: 18,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "var(--mint)",
          color: "var(--ink)",
          zIndex: 5,
        }}
        aria-label="친구 추가"
        title="친구 추가"
        type="button"
      >
        <UserPlus size={22} />
      </button>

      <AddFriendSheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        currentUserId={currentUserId}
      />
    </div>
  );
}

// ── Sub: Add friend sheet ─────────────────────────────────────
function AddFriendSheet({
  open,
  onClose,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  currentUserId: number;
}) {
  const [query, setQuery] = useState("");
  const utils = trpc.useUtils();

  const { data: results = [], isLoading } = trpc.chat.searchUsers.useQuery(
    { query },
    { enabled: query.trim().length >= 1 }
  );
  const { data: friends = [] } = trpc.friends.list.useQuery();
  const friendIds = new Set(friends.map((f) => f.friendId));

  const addFriend = trpc.friends.add.useMutation({
    onSuccess: () => {
      toast.success("친구로 추가했어요");
      utils.friends.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <BottomSheet open={open} onClose={onClose} title="친구 추가">
      <div className="relative mb-3">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--fg-muted)" }}
        />
        <input
          type="text"
          placeholder="이름·이메일로 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="soft-input w-full pl-9 pr-3 py-2.5 text-sm"
          autoFocus
        />
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: "min(50vh, 320px)" }}>
        {!query.trim() && (
          <p className="text-center text-sm py-6" style={{ color: "var(--fg-muted)" }}>
            친구의 이름이나 이메일을 검색하세요
          </p>
        )}
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}
        {!isLoading &&
          (results as Array<{
            id: number;
            name: string | null;
            email: string | null;
            avatarUrl: string | null;
            statusMessage: string | null;
          }>).map((u) => {
            if (u.id === currentUserId) return null;
            const isFriend = friendIds.has(u.id);
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 px-2 py-2.5 rounded-xl"
              >
                <UserAvatar name={u.name ?? "?"} avatarUrl={u.avatarUrl} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{u.name ?? "이름 없음"}</p>
                  <p className="text-xs truncate" style={{ color: "var(--fg-muted)" }}>
                    {u.statusMessage ?? u.email ?? ""}
                  </p>
                </div>
                <button
                  disabled={isFriend || addFriend.isPending}
                  onClick={() => addFriend.mutate({ friendId: u.id })}
                  className="memphis-btn px-3 py-1.5 text-xs font-bold"
                  style={{
                    background: isFriend ? "var(--bg-muted)" : "var(--mint)",
                    color: isFriend ? "var(--fg-muted)" : "var(--ink)",
                    borderRadius: "0.625rem",
                  }}
                  type="button"
                >
                  {isFriend ? "친구" : "추가"}
                </button>
              </div>
            );
          })}
      </div>
    </BottomSheet>
  );
}
