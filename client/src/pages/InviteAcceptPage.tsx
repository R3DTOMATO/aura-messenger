import React, { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import UserAvatar from "@/components/UserAvatar";
import MemphisBackground from "@/components/MemphisBackground";
import { Loader2, UserPlus, MessageCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function InviteAcceptPage() {
  const [, params] = useRoute("/invite/:code");
  const [, setLocation] = useLocation();
  const code = params?.code ?? "";
  const { user, loading: authLoading } = useAuth();
  const [done, setDone] = useState(false);

  const { data: preview, isLoading, error } = trpc.invites.preview.useQuery(
    { code },
    { enabled: !!code, retry: false }
  );

  const accept = trpc.invites.accept.useMutation({
    onSuccess: () => {
      toast.success("친구로 추가되었습니다!");
      setDone(true);
      // Redirect to home after a moment
      setTimeout(() => setLocation("/"), 1200);
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  // If not logged in, save invite code and redirect to login
  useEffect(() => {
    if (!authLoading && !user && code) {
      try {
        sessionStorage.setItem("pendingInvite", code);
      } catch {
        // ignore
      }
      setLocation("/");
    }
  }, [user, authLoading, code, setLocation]);

  if (authLoading || isLoading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: "100dvh", background: "var(--bg)" }}
      >
        <Loader2 size={32} className="animate-spin" style={{ color: "var(--fg-muted)" }} />
      </div>
    );
  }

  if (!user) {
    return null; // Redirecting
  }

  if (!code || error || !preview) {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{ height: "100dvh", background: "var(--bg)" }}
      >
        <MemphisBackground />
        <div
          className="relative z-10 flex flex-col items-center text-center animate-bounce-in"
          style={{
            background: "var(--bg-elevated)",
            border: "2.5px solid var(--border)",
            borderRadius: "1.75rem",
            boxShadow: "6px 6px 0 var(--border)",
            padding: "2.5rem 2rem",
            maxWidth: 360,
            width: "calc(100% - 2rem)",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--coral)",
              border: "2px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
              color: "white",
            }}
          >
            <XCircle size={32} />
          </div>
          <h2 className="font-display" style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>
            유효하지 않은 초대
          </h2>
          <p style={{ color: "var(--fg-muted)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            초대 링크가 만료되었거나 잘못된 주소예요
          </p>
          <button
            onClick={() => setLocation("/")}
            className="memphis-btn w-full py-2.5 font-bold"
            style={{
              background: "var(--ink)",
              color: "var(--white)",
              borderRadius: "0.75rem",
            }}
            type="button"
          >
            홈으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ height: "100dvh", background: "var(--bg)" }}
    >
      <MemphisBackground />
      <div
        className="relative z-10 flex flex-col items-center text-center animate-bounce-in"
        style={{
          background: "var(--bg-elevated)",
          border: "2.5px solid var(--border)",
          borderRadius: "1.75rem",
          boxShadow: "6px 6px 0 var(--border)",
          padding: "2.5rem 2rem",
          maxWidth: 380,
          width: "calc(100% - 2rem)",
        }}
      >
        <UserAvatar
          name={preview.ownerName ?? "?"}
          avatarUrl={preview.ownerAvatarUrl}
          size="xl"
        />
        <h2
          className="font-display"
          style={{ fontSize: "1.4rem", marginTop: "1rem", marginBottom: "0.25rem" }}
        >
          {preview.ownerName ?? "이름 없음"}
        </h2>
        {preview.ownerStatusMessage && (
          <p
            style={{
              color: "var(--fg-muted)",
              fontSize: "0.85rem",
              marginBottom: "0.5rem",
            }}
          >
            {preview.ownerStatusMessage}
          </p>
        )}
        <p
          style={{
            color: "var(--fg-soft)",
            fontSize: "0.9rem",
            marginTop: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          이 사람을 친구로 추가하고
          <br />
          대화를 시작하시겠어요?
        </p>

        {done ? (
          <div
            className="flex items-center justify-center gap-2 py-2.5 font-bold"
            style={{ color: "var(--mint-dark)" }}
          >
            <MessageCircle size={18} />
            완료! 이동 중...
          </div>
        ) : (
          <button
            onClick={() => accept.mutate({ code })}
            disabled={accept.isPending}
            className="memphis-btn w-full py-3 font-bold flex items-center justify-center gap-2"
            style={{
              background: "var(--yellow)",
              color: "var(--ink)",
              borderRadius: "0.875rem",
            }}
            type="button"
          >
            {accept.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <UserPlus size={16} />
                친구 추가하고 대화 시작
              </>
            )}
          </button>
        )}

        <button
          onClick={() => setLocation("/")}
          style={{
            marginTop: "0.75rem",
            background: "transparent",
            border: 0,
            cursor: "pointer",
            fontSize: "0.8rem",
            color: "var(--fg-muted)",
            fontFamily: "inherit",
          }}
          type="button"
        >
          나중에
        </button>
      </div>
    </div>
  );
}
