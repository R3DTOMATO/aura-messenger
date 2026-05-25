import React, { useEffect, useRef, useState } from "react";
import UserAvatar from "./UserAvatar";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneIncoming,
} from "lucide-react";
import type { CallState } from "@/hooks/useCall";

interface CallScreenProps {
  state: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
}

function formatDuration(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function CallScreen({
  state,
  localStream,
  remoteStream,
  muted,
  cameraOff,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleCamera,
}: CallScreenProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (state.status !== "active") {
      setDuration(0);
      return;
    }
    const startedAt = state.startedAt;
    const tick = () => setDuration(Date.now() - startedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state]);

  if (state.status === "idle") return null;

  const peer = state.peer;
  const isVideo = state.kind === "video";

  // ── Incoming call: simple sheet at bottom ─────────────────
  if (state.status === "incoming") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 100,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          className="animate-slide-up"
          style={{
            background: "var(--bg-elevated)",
            borderRadius: "1.25rem",
            border: "2.5px solid var(--border)",
            boxShadow: "6px 6px 0 var(--border)",
            padding: "1.5rem",
            width: "100%",
            maxWidth: 400,
            color: "var(--fg)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <UserAvatar
              name={peer.name ?? "?"}
              avatarUrl={peer.avatarUrl}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{peer.name ?? "알 수 없음"}</div>
              <div
                className="text-sm flex items-center gap-1.5"
                style={{ color: "var(--mint-dark)" }}
              >
                <PhoneIncoming size={14} className="animate-pulse-dot" />
                {isVideo ? "영상통화" : "음성통화"} 수신
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onReject}
              className="memphis-btn flex-1 py-3 font-bold flex items-center justify-center gap-1.5"
              style={{
                background: "var(--coral)",
                color: "white",
                borderRadius: "0.875rem",
              }}
              type="button"
            >
              <PhoneOff size={18} />
              거절
            </button>
            <button
              onClick={onAccept}
              className="memphis-btn flex-1 py-3 font-bold flex items-center justify-center gap-1.5"
              style={{
                background: "var(--mint-dark)",
                color: "white",
                borderRadius: "0.875rem",
              }}
              type="button"
            >
              <Phone size={18} />
              받기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Outgoing / Active: fullscreen ─────────────────────────
  const statusText =
    state.status === "outgoing" ? "연결 중..." : formatDuration(duration);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0a0a",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        color: "white",
      }}
    >
      {/* Remote video / avatar */}
      <div
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {isVideo && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <UserAvatar
              name={peer.name ?? "?"}
              avatarUrl={peer.avatarUrl}
              size="xl"
            />
            <div className="text-center">
              <div className="font-bold text-xl mb-1">
                {peer.name ?? "알 수 없음"}
              </div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" }}>
                {statusText}
              </div>
            </div>
          </div>
        )}

        {/* Local video preview (PiP) */}
        {isVideo && localStream && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              position: "absolute",
              top: "calc(env(safe-area-inset-top, 0) + 12px)",
              right: 12,
              width: 100,
              height: 140,
              objectFit: "cover",
              borderRadius: 12,
              border: "2px solid white",
              background: "#222",
              transform: "scaleX(-1)", // mirror for self-view
            }}
          />
        )}

        {/* Header info (overlay on video, or just below for audio) */}
        {isVideo && (
          <div
            style={{
              position: "absolute",
              top: "calc(env(safe-area-inset-top, 0) + 12px)",
              left: 12,
              padding: "6px 12px",
              background: "rgba(0,0,0,0.4)",
              borderRadius: 999,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <div className="font-bold text-sm">{peer.name ?? "알 수 없음"}</div>
            <div style={{ fontSize: "0.7rem", opacity: 0.8 }}>{statusText}</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        style={{
          padding:
            "1.5rem 1.5rem calc(1.5rem + env(safe-area-inset-bottom, 0))",
          display: "flex",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <button
          onClick={onToggleMute}
          aria-label={muted ? "마이크 켜기" : "마이크 끄기"}
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: muted ? "white" : "rgba(255,255,255,0.2)",
            color: muted ? "#0a0a0a" : "white",
            border: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          type="button"
        >
          {muted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {isVideo && (
          <button
            onClick={onToggleCamera}
            aria-label={cameraOff ? "카메라 켜기" : "카메라 끄기"}
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: cameraOff ? "white" : "rgba(255,255,255,0.2)",
              color: cameraOff ? "#0a0a0a" : "white",
              border: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            type="button"
          >
            {cameraOff ? <VideoOff size={22} /> : <VideoIcon size={22} />}
          </button>
        )}

        <button
          onClick={onEnd}
          aria-label="통화 종료"
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--coral)",
            color: "white",
            border: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          type="button"
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );
}
