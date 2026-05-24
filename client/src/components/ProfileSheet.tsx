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
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

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

  const utils = trpc.useUtils();
  const { data: profile } = trpc.users.getById.useQuery(
    { userId: user.id },
    { enabled: open }
  );

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

  const handleNotifPermission = () => {
    if (!("Notification" in window)) {
      toast.error("이 기기는 알림을 지원하지 않아요");
      return;
    }
    if (Notification.permission === "granted") {
      toast.info("알림이 이미 켜져있어요");
      return;
    }
    Notification.requestPermission().then((p) => {
      if (p === "granted") toast.success("알림을 켰어요");
      else toast.error("알림 권한이 거부되었어요");
    });
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
      <button className="sheet-item" onClick={handleNotifPermission} type="button">
        <Bell size={18} />
        알림 허용
      </button>

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
