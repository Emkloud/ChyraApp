// frontend/src/context/SocketContext.jsx
// ⚡ Central Socket.IO context for ChyraApp (stable + message helper)

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import notificationService from "../services/notificationService";

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  const userId = user?._id || user?.id || null;

  useEffect(() => {
    if (!userId) {
      cleanupSocket();
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      cleanupSocket();
      return;
    }

    const SOCKET_URL =
      typeof window !== "undefined" &&
      window.location.hostname.endsWith("chyraapp.com")
        ? "https://api.chyraapp.com"
        : "http://localhost:5000";

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      console.log("✅ Socket connected:", socket.id);
      socket.emit("auth", { userId });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("❌ Socket disconnected");
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
    });

    // Online users list from backend
    socket.on("users:online", (userIds) => {
      const list = Array.isArray(userIds) ? userIds : [];
      setOnlineUsers(list);
      console.log("📡 Online users:", list);
    });

    // Global message listener for notifications (not for UI rendering)
    socket.on("message:receive", (msg) => {
      try {
        const senderId = msg?.sender?._id || msg?.sender;
        if (!senderId || senderId === userId) return;

        const senderName =
          msg?.sender?.fullName ||
          msg?.sender?.username ||
          "Someone";

        const text =
          msg?.text ||
          (typeof msg?.content === "string"
            ? msg.content
            : msg?.content?.text) ||
          "New message";

        notificationService.notifyNewMessage(
          senderName,
          text,
          msg.conversationId
        );
      } catch (err) {
        console.error(
          "Error in global message:receive handler:",
          err
        );
      }
    });

    return () => {
      cleanupSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const cleanupSocket = () => {
    if (socketRef.current) {
      try {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      } catch (err) {
        console.error("Error cleaning up socket:", err);
      }
      socketRef.current = null;
    }
    setIsConnected(false);
    setOnlineUsers([]);
  };

  /* ------------ Helpers used by ChatWindow & others ------------ */

  const joinConversation = (conversationId) => {
    if (!socketRef.current || !conversationId) return;
    socketRef.current.emit("conversation:join", { conversationId });
  };

  const leaveConversation = (conversationId) => {
    if (!socketRef.current || !conversationId) return;
    socketRef.current.emit("conversation:leave", { conversationId });
  };

  const emitTyping = (conversationId) => {
    if (!socketRef.current || !conversationId) return;
    socketRef.current.emit("typing:start", { conversationId });
  };

  const emitStopTyping = (conversationId) => {
    if (!socketRef.current || !conversationId) return;
    socketRef.current.emit("typing:stop", { conversationId });
  };

  const markAsRead = (messageId, conversationId) => {
    if (!socketRef.current || !messageId || !conversationId) return;
    socketRef.current.emit("message:read", { messageId, conversationId });
  };

  // 💬 Unified sendMessage helper so UI code is simple and reliable
  const sendMessage = ({
    conversationId,
    text,
    type = "text",
    media,
    replyTo,
  }) => {
    if (!socketRef.current || !conversationId) return;
    const content =
      typeof text === "string"
        ? { text, type }
        : text || { text: "", type };

    socketRef.current.emit("message:send", {
      conversationId,
      content,
      media,
      replyTo,
    });
  };

  const value = {
    socket: socketRef.current,
    isConnected,
    onlineUsers,
    joinConversation,
    leaveConversation,
    emitTyping,
    emitStopTyping,
    markAsRead,
    sendMessage,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
