import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getAccess } from "../api/index.js";
import { useStore } from "../store/index.js";

let _socket = null;
export const getSocket = () => _socket;

export function useSocket(user) {
  const ref = useRef(null);
  const { setOnline, incUnreadMessages, activeConvId, showToast, setPostState } = useStore();

  useEffect(() => {
    if (!user) {
      _socket?.disconnect();
      _socket = null;
      return;
    }

    const token = getAccess();
    if (!token) return;

    const socket = io(import.meta.env.VITE_API_URL || "", {
      auth: { token, username: user.username },
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    _socket = socket;
    ref.current = socket;

    socket.on("connect",    () => console.log("🔌 Socket connected"));
    socket.on("disconnect", (r) => console.log("🔌 Socket disconnected:", r));
    socket.on("connect_error", (e) => console.warn("Socket error:", e.message));

    socket.on("presence", ({ userId, online }) => setOnline(userId, online));

    socket.on("new_message", (msg) => {
      if (msg.conversation_id !== activeConvId) {
        incUnreadMessages();
        showToast(`💬 ${msg.sender?.username || "Someone"}: ${(msg.text || "📷 Photo").slice(0, 40)}`, "info");
      }
    });

    socket.on("post_stats_update", ({ post_id }) => {
      // individual components can re-fetch if needed
    });

    return () => {
      socket.disconnect();
      _socket = null;
    };
  }, [user?.id]);

  return ref.current;
}
