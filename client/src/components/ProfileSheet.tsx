import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import BottomSheet from "./BottomSheet";
import UserAvatar from "./UserAvatar";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Moon,
  Sun,
  LogOut,
  Edit3,
  Save,
  X as XIcon,
  Bell,
  BellOff,
  MessageSquare,
  Link as LinkIcon,
  Copy,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  subscribeToPush,
  unsubscribeFromPush,
  getPushPermissionState,
  isPushSupported,
} from "@/lib/push";

interface ProfileSheetProps {
  open: boolean;
  onClose: () => void;
  user: { id: number; name: string | null; email: string | null; avatarUrl: string | null };
  onLogout: () => void;
}

export default function ProfileSheet({ open, onClose, user, onLogout }: ProfileSheetProps) {
  const { theme, setTheme } = useTheme();
  const [editingName, setEditingName] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [name, setName] = useState(user.name ?? "");
  const [statusMsg, setStatusMsg] = useState("");
  const [pushState, setPushState] = useState<NotificationPermission | "unsupported">("default");
  const [pushBusy, setPushBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);

  const utils = trpc.useUtils();
  const { data: profile } = trpc.users.getById.useQuery(
    { userId: user.id },
    { enabled: open }
  );

  // Push key + subscription helpers
  const { data: pushKey } = trpc.push.publicKey.useQuery(undefined, { enabled: open });
  const subscribePush = trpc.push.subscribe.useMutation();
  const unsubscribePush = trpc.push.unsubscribe.useMutation();

  // Invite link
  const { data: myInvites = [] } = trpc.invites.listMine.useQuery(undefined, {
    enabled: open,
  });
  const createInvite = trpc.invites.create.useMutation({
    onSuccess: () => utils.invites.listMine.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const revokeInvite = trpc.invites.revoke.useMutation({
    onSuccess: () => {
      utils.invites.listMine.invalidate();
      toast.success("초대 링크를 비활성화했습니다");
    },
  });

  useEffect(() => {
    if (!open) return;
    getPushPermissionState().then(setPushState);
  }, [open]);

  useEffect(() => {
    setName(user.name ?? "");
  }, [user.name]);
  useEffect(() => {
    setStatusMsg(profile?.statusMessage ?? "");
  }, [profile?.statusMessage]);

  const updateProfile = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("프로필을 업데이트했어요");
      utils.users.getById.invalidate({ userId: user.id });
      utils.auth.me.invalidate();
      setEditingName(false);
      setEditingStatus(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleTogglePush = async () => {
    if (!isPushSupported()) {
      toast.error("이 기기는 푸시 알림을 지원하지 않아요");
      return;
    }
    if (!pushKey?.publicKey) {
      toast.error("서버에 푸시 키가 설정되지 않았어요");
      return;
    }
    setPushBusy(true);
    try {
      if (pushState === "granted") {
        const ok = await unsubscribeFromPush(async (endpoint: string) => {
          await unsubscribePush.mutateAsync({ endpoint });
        });
        if (ok) {
          toast.success("푸시 알림을 껐어요");
          setPushState("default");
        }
      } else {
        const result = await subscribeToPush(
          pushKey.publicKey,
          async (sub: PushSubscription) => {
            const json = sub.toJSON();
            if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
              throw new Error("잘못된 구독 정보");
            }
            await subscribePush.mutateAsync({
              endpoint: json.endpoint,
              keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
              userAgent: navigator.userAgent,
            });
          }
        );
        if (result.ok) {
          toast.success("푸시 알림을 켰어요");
          setPushState("granted");
        } else {
          toast.error(result.reason ?? "푸시 구독 실패");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "푸시 설정 중 오류");
    } finally {
      setPushBusy(false);
    }
  };

  const handleCreateInvite = async () => {
    setInviteBusy(true);
    try {
      const result = await createInvite.mutateAsync({ expiresInDays: 30 });
      const url = `${window.location.origin}/invite/${result.code}`;
      await navigator.clipboard.writeText(url);
      toast.success("초대 링크를 복사했어요");
    } catch {
      // mutate already handled error toast
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCopyInvite = async (code: string) => {
    const url = `${window.location.origin}/invite/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("복사되었습니다");
    } catch {
      toast.error("복사에 실패했습니다");
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="내 프로필">
      <div className="flex flex-col items-center py-2 mb-3">
        <UserAvatar name={user.name ?? "?"} avatarUrl={user.avatarUrl} size="xl" />
        <div className="mt-3 w-full px-2 text-center">
          {editingName ? (
            <div className="flex items-center gap-1 justify-center">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="memphis-input text-center px-3 py-1.5 text-sm font-bold"
                maxLength={80}
                style={{ width: "min(220px, 80%)" }}
                autoFocus
              />
              <button
                onClick={() => updateProfile.mutate({ name: name.trim() || "사용자" })}
                className="icon-btn"
                style={{ width: 30, height: 30 }}
                type="button"
                aria-label="저장"
              >
                <Save size={15} />
              </button>
              <button
                onClick={() => {
                  setEditingName(false);
                  setName(user.name ?? "");
                }}
                className="icon-btn"
                style={{ width: 30, height: 30 }}
                type="button"
                aria-label="취소"
              >
                <XIcon size={15} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="font-bold text-lg flex items-center gap-1.5 mx-auto"
              style={{
                background: "transparent",
                border: 0,
                cursor: "pointer",
                color: "var(--fg)",
              }}
              type="button"
            >
              {user.name ?? "이름 없음"}
              <Edit3 size={13} style={{ color: "var(--fg-muted)" }} />
            </button>
          )}
          <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
            {user.email ?? ""}
          </p>

          {/* Status message */}
          <div className="mt-3 max-w-full">
            {editingStatus ? (
              <div className="flex flex-col items-center gap-1.5">
                <textarea
                  value={statusMsg}
                  onChange={(e) => setStatusMsg(e.target.value.slice(0, 140))}
                  placeholder="상태 메시지 (140자)"
                  className="memphis-input px-3 py-2 text-sm resize-none w-full"
                  rows={2}
                  maxLength={140}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
                    {statusMsg.length}/140
                  </span>
                  <button
                    onClick={() =>
                      updateProfile.mutate({
                        statusMessage: statusMsg.trim() || null,
                      })
                    }
                    className="memphis-btn px-3 py-1 text-xs font-bold"
                    style={{
                      background: "var(--yellow)",
                      color: "var(--ink)",
                      borderRadius: "0.5rem",
                    }}
                    type="button"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => {
                      setEditingStatus(false);
                      setStatusMsg(profile?.statusMessage ?? "");
                    }}
                    className="text-xs font-bold"
                    style={{
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      color: "var(--fg-muted)",
                    }}
                    type="button"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditingStatus(true)}
                className="flex items-center gap-1.5 mx-auto text-sm px-3 py-1.5 rounded-full"
                style={{
                  background: "var(--bg-muted)",
                  border: 0,
                  cursor: "pointer",
                  color: "var(--fg-soft)",
                  maxWidth: "100%",
                }}
                type="button"
              >
                <MessageSquare size={12} />
                <span className="truncate">
                  {profile?.statusMessage || "상태 메시지를 입력하세요"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: "var(--border-soft)", margin: "8px 0" }} />

      {/* Settings */}
      <button
        className="sheet-item"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        type="button"
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        {theme === "dark" ? "라이트 모드" : "다크 모드"}
      </button>
      <button
        className="sheet-item"
        onClick={handleTogglePush}
        disabled={pushBusy || pushState === "unsupported"}
        type="button"
      >
        {pushBusy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : pushState === "granted" ? (
          <Bell size={18} style={{ color: "var(--mint-dark)" }} />
        ) : (
          <BellOff size={18} />
        )}
        {pushState === "unsupported"
          ? "이 기기는 푸시 미지원"
          : pushState === "granted"
          ? "푸시 알림 끄기"
          : "푸시 알림 켜기"}
      </button>

      {/* Invite link */}
      <button
        className="sheet-item"
        onClick={handleCreateInvite}
        disabled={inviteBusy}
        type="button"
      >
        {inviteBusy ? <Loader2 size={18} className="animate-spin" /> : <LinkIcon size={18} />}
        내 초대 링크 만들고 복사
      </button>
      {myInvites.length > 0 && (
        <div
          style={{
            padding: "6px 8px 0",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {(myInvites as { code: string; usedCount: number; maxUses: number | null }[])
            .slice(0, 3)
            .map((inv) => (
              <div
                key={inv.code}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--bg-muted)",
                  borderRadius: 10,
                  padding: "6px 8px",
                  fontSize: "0.72rem",
                }}
              >
                <code
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "var(--fg-soft)",
                  }}
                >
                  /invite/{inv.code}
                </code>
                <span style={{ color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
                  {inv.usedCount}/{inv.maxUses ?? "∞"}
                </span>
                <button
                  onClick={() => handleCopyInvite(inv.code)}
                  className="icon-btn"
                  style={{ width: 24, height: 24 }}
                  aria-label="복사"
                  type="button"
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={() => revokeInvite.mutate({ code: inv.code })}
                  className="icon-btn"
                  style={{ width: 24, height: 24, color: "var(--coral)" }}
                  aria-label="비활성화"
                  type="button"
                >
                  <XIcon size={12} />
                </button>
              </div>
            ))}
        </div>
      )}

      <div style={{ height: 1, background: "var(--border-soft)", margin: "8px 0" }} />

      <button
        className="sheet-item destructive"
        onClick={() => {
          if (!confirm("로그아웃 하시겠어요?")) return;
          onLogout();
        }}
        type="button"
      >
        <LogOut size={18} />
        로그아웃
      </button>
    </BottomSheet>
  );
}
