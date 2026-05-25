import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "./useSocket";
import { toast } from "sonner";

export type CallKind = "audio" | "video";

export type CallState =
  | { status: "idle" }
  | {
      status: "outgoing";
      kind: CallKind;
      peer: { id: number; name: string | null; avatarUrl: string | null };
    }
  | {
      status: "incoming";
      kind: CallKind;
      peer: { id: number; name: string | null; avatarUrl: string | null };
    }
  | {
      status: "active";
      kind: CallKind;
      peer: { id: number; name: string | null; avatarUrl: string | null };
      startedAt: number;
    };

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export interface UseCallOptions {
  currentUser: {
    id: number;
    name: string | null;
    avatarUrl: string | null;
  } | null;
}

interface IncomingPayload {
  from: number;
  caller: { id: number; name: string | null; avatarUrl: string | null };
  kind: CallKind;
}

interface SignalPayload {
  from: number;
  data: unknown;
}

interface AcceptedPayload {
  from: number;
}

interface EndedPayload {
  from: number;
  reason?: string;
}

interface RejectedPayload {
  from: number;
  reason?: string;
}

export function useCall({ currentUser }: UseCallOptions) {
  const [callState, setCallState] = useState<CallState>({ status: "idle" });
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  // Buffer offer that arrives before user accepts
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const peerIdRef = useRef<number | null>(null);
  const kindRef = useRef<CallKind>("audio");
  const isCallerRef = useRef<boolean>(false);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setRemoteStream(null);
    pendingCandidatesRef.current = [];
    pendingOfferRef.current = null;
    peerIdRef.current = null;
    isCallerRef.current = false;
    setMuted(false);
    setCameraOff(false);
    setCallState({ status: "idle" });
  }, []);

  const sendSignal = useCallback((toUserId: number, data: unknown) => {
    getSocket()?.emit("call_signal", { toUserId, data });
  }, []);

  const createPeerConnection = useCallback(
    (peerId: number) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(peerId, { type: "ice", candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) setRemoteStream(stream);
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "failed" || state === "disconnected" || state === "closed") {
          if (state === "failed") {
            toast.error("통화 연결이 실패했습니다");
          }
          getSocket()?.emit("call_end", { toUserId: peerId });
          cleanup();
        }
      };

      return pc;
    },
    [cleanup, sendSignal]
  );

  const acquireLocalStream = useCallback(async (kind: CallKind) => {
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: kind === "video",
    };
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      return stream;
    } catch (e) {
      toast.error(
        kind === "video"
          ? "카메라/마이크 권한이 필요합니다"
          : "마이크 권한이 필요합니다"
      );
      throw e;
    }
  }, []);

  // ── Start a call (caller side) ──────────────────────────────
  const startCall = useCallback(
    async (
      peer: { id: number; name: string | null; avatarUrl: string | null },
      kind: CallKind
    ) => {
      if (!currentUser) return;
      if (callState.status !== "idle") {
        toast.error("이미 통화 중입니다");
        return;
      }
      isCallerRef.current = true;
      peerIdRef.current = peer.id;
      kindRef.current = kind;
      setCallState({ status: "outgoing", kind, peer });

      const socket = getSocket();
      if (!socket) {
        toast.error("연결되지 않았습니다");
        cleanup();
        return;
      }
      socket.emit("call_invite", {
        toUserId: peer.id,
        kind,
        caller: {
          id: currentUser.id,
          name: currentUser.name,
          avatarUrl: currentUser.avatarUrl,
        },
      });
    },
    [currentUser, callState.status, cleanup]
  );

  // ── Accept an incoming call (callee side) ───────────────────
  const acceptCall = useCallback(async () => {
    if (callState.status !== "incoming") return;
    const peer = callState.peer;
    const kind = callState.kind;
    peerIdRef.current = peer.id;
    kindRef.current = kind;
    isCallerRef.current = false;

    try {
      const stream = await acquireLocalStream(kind);
      const pc = createPeerConnection(peer.id);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // Tell caller we accepted; caller will create offer
      getSocket()?.emit("call_accept", { toUserId: peer.id });
      setCallState({ status: "active", kind, peer, startedAt: Date.now() });

      // If offer was buffered, process it now
      if (pendingOfferRef.current) {
        await pc.setRemoteDescription(pendingOfferRef.current);
        pendingOfferRef.current = null;
        // Drain buffered ICE candidates
        for (const c of pendingCandidatesRef.current) {
          try {
            await pc.addIceCandidate(c);
          } catch {
            // ignore
          }
        }
        pendingCandidatesRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(peer.id, { type: "answer", sdp: answer });
      }
    } catch {
      getSocket()?.emit("call_reject", {
        toUserId: peer.id,
        reason: "media_error",
      });
      cleanup();
    }
  }, [callState, acquireLocalStream, createPeerConnection, cleanup, sendSignal]);

  // ── Reject an incoming call ─────────────────────────────────
  const rejectCall = useCallback(() => {
    if (callState.status !== "incoming") return;
    getSocket()?.emit("call_reject", {
      toUserId: callState.peer.id,
      reason: "rejected",
    });
    cleanup();
  }, [callState, cleanup]);

  // ── Hang up ─────────────────────────────────────────────────
  const endCall = useCallback(() => {
    const peerId = peerIdRef.current;
    if (peerId) {
      getSocket()?.emit("call_end", { toUserId: peerId });
    }
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !cameraOff;
    stream.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCameraOff(next);
  }, [cameraOff]);

  // ── Socket handlers ─────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !currentUser) return;

    const onInvite = (payload: IncomingPayload) => {
      // If already in a call, auto-reject
      if (callState.status !== "idle") {
        socket.emit("call_reject", { toUserId: payload.from, reason: "busy" });
        return;
      }
      peerIdRef.current = payload.from;
      kindRef.current = payload.kind;
      setCallState({
        status: "incoming",
        kind: payload.kind,
        peer: payload.caller,
      });
    };

    const onAccepted = async (payload: AcceptedPayload) => {
      // Caller side: callee accepted; create offer
      if (!isCallerRef.current) return;
      try {
        const stream = await acquireLocalStream(kindRef.current);
        const pc = createPeerConnection(payload.from);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal(payload.from, { type: "offer", sdp: offer });

        const peer =
          callState.status === "outgoing"
            ? callState.peer
            : {
                id: payload.from,
                name: null,
                avatarUrl: null,
              };
        setCallState({
          status: "active",
          kind: kindRef.current,
          peer,
          startedAt: Date.now(),
        });
      } catch {
        endCall();
      }
    };

    const onRejected = (payload: RejectedPayload) => {
      if (payload.reason === "busy") toast.info("상대방이 통화 중입니다");
      else if (payload.reason === "media_error")
        toast.error("상대방이 마이크/카메라에 접근할 수 없습니다");
      else toast.info("통화가 거절되었습니다");
      cleanup();
    };

    const onSignal = async (payload: SignalPayload) => {
      const data = payload.data as
        | { type: "offer"; sdp: RTCSessionDescriptionInit }
        | { type: "answer"; sdp: RTCSessionDescriptionInit }
        | { type: "ice"; candidate: RTCIceCandidateInit };

      // Offer might arrive before we accept (race)
      if (data.type === "offer") {
        const pc = pcRef.current;
        if (!pc) {
          // Buffer the offer until accept
          pendingOfferRef.current = data.sdp;
          return;
        }
        await pc.setRemoteDescription(data.sdp);
        for (const c of pendingCandidatesRef.current) {
          try {
            await pc.addIceCandidate(c);
          } catch {
            // ignore
          }
        }
        pendingCandidatesRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(payload.from, { type: "answer", sdp: answer });
      } else if (data.type === "answer") {
        const pc = pcRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(data.sdp);
      } else if (data.type === "ice") {
        const pc = pcRef.current;
        if (!pc || !pc.remoteDescription) {
          pendingCandidatesRef.current.push(data.candidate);
        } else {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch {
            // ignore
          }
        }
      }
    };

    const onEnded = (_payload: EndedPayload) => {
      if (callState.status !== "idle") {
        toast.info("통화가 종료되었습니다");
      }
      cleanup();
    };

    socket.on("call_invite", onInvite);
    socket.on("call_accepted", onAccepted);
    socket.on("call_rejected", onRejected);
    socket.on("call_signal", onSignal);
    socket.on("call_ended", onEnded);

    return () => {
      socket.off("call_invite", onInvite);
      socket.off("call_accepted", onAccepted);
      socket.off("call_rejected", onRejected);
      socket.off("call_signal", onSignal);
      socket.off("call_ended", onEnded);
    };
  }, [
    currentUser,
    callState,
    acquireLocalStream,
    createPeerConnection,
    sendSignal,
    cleanup,
    endCall,
  ]);

  return {
    callState,
    localStream: localStreamRef.current,
    remoteStream,
    muted,
    cameraOff,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
}
