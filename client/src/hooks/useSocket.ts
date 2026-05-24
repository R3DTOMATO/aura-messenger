import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

let globalSocket: Socket | null = null;

export function useSocket(userId: number | undefined) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;

    if (!globalSocket || !globalSocket.connected) {
      globalSocket = io(window.location.origin, {
        path: "/api/socket.io",
        auth: { userId },
        transports: ["websocket", "polling"],
      });
    }

    socketRef.current = globalSocket;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    globalSocket.on("connect", onConnect);
    globalSocket.on("disconnect", onDisconnect);

    if (globalSocket.connected) setConnected(true);

    return () => {
      globalSocket?.off("connect", onConnect);
      globalSocket?.off("disconnect", onDisconnect);
    };
  }, [userId]);

  return { socket: socketRef.current ?? globalSocket, connected };
}

export function getSocket() {
  return globalSocket;
}
