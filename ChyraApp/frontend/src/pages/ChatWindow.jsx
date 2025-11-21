// frontend/src/pages/ChatWindow.jsx
// 🚀 Mobile-optimized chat window for ChyraApp
// - Sticky header + sticky input (only messages scroll)
// - Robust "isMine" detection so sender bubbles are on the right
// - WhatsApp-style "Last seen" text (minutes / hours / yesterday / date)
// - Date separators between message days (Today / Yesterday / Date)
// - Read receipts (✓ / ✓✓) with tighter spacing & better contrast

import React, { useEffect, useState, useRef, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import chatService from "../services/chatService";
import messageService from "../services/messageService";

const PAGE_SIZE = 50;

/* ---------------- Date helpers ---------------- */

function isSameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function formatDateLabel(dateRaw) {
  const d = new Date(dateRaw);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const diffDays = Math.round(
    (today.getTime() - thatDay.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

// Format "Last seen" like WhatsApp-style
function formatLastSeen(isOnline, lastSeenRaw) {
  if (isOnline) return "Online";
  if (!lastSeenRaw) return "Last seen a while ago";

  const lastSeen = new Date(lastSeenRaw);
  const now = new Date();

  const diffMs = now.getTime() - lastSeen.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = new Date(
    lastSeen.getFullYear(),
    lastSeen.getMonth(),
    lastSeen.getDate()
  );

  const isToday = today.getTime() === lastDay.getTime();
  const isYesterday =
    today.getTime() - lastDay.getTime() === 24 * 60 * 60 * 1000;

  if (diffMinutes < 1) {
    return "Last seen less than a minute ago";
  }

  if (diffMinutes === 1) {
    return "Last seen a minute ago";
  }

  if (diffMinutes < 60) {
    return `Last seen ${diffMinutes} minutes ago`;
  }

  if (diffHours === 1 && isToday) {
    return "Last seen an hour ago";
  }

  if (diffHours < 24 && isToday) {
    return `Last seen ${diffHours} hours ago`;
  }

  const timePart = lastSeen.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isYesterday) {
    return `Last seen yesterday at ${timePart}`;
  }

  const datePart = lastSeen.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: lastSeen.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });

  return `Last seen ${datePart} at ${timePart}`;
}

/* ---------------- Normalizers ---------------- */

function normalizeConversation(conv, meId) {
  if (!conv || !conv._id) return null;

  const me = meId ? String(meId) : null;
  const isGroup = !!conv.isGroup;

  const participants = Array.isArray(conv.participants)
    ? conv.participants
        .map((p) => p?.user || p)
        .filter((u) => u && u._id)
    : [];

  let title = "Chat";
  let avatarInitial = "C";
  let otherUser = null;

  if (isGroup) {
    title = conv.groupName || conv.name || "Group Chat";
    avatarInitial = title[0]?.toUpperCase() || "G";
  } else {
    otherUser =
      participants.find((p) => me && String(p._id) !== me) ||
      participants[0] ||
      null;

    title =
      otherUser?.fullName ||
      otherUser?.username ||
      conv.name ||
      conv.groupName ||
      "Unknown User";

    avatarInitial = title[0]?.toUpperCase() || "U";
  }

  return {
    ...conv,
    isGroup,
    participants,
    title,
    avatarInitial,
    otherUser,
    otherUserId: otherUser?._id || null,
  };
}

function normalizeMessage(msg, meId) {
  if (!msg) return null;

  const me = meId ? String(meId) : null;

  const senderRaw = msg.sender ?? msg.from ?? msg.author ?? null;
  let senderObj = senderRaw;

  if (!senderObj || typeof senderObj !== "object") {
    senderObj = { _id: senderRaw };
  }

  const senderId =
    senderObj._id ||
    senderObj.id ||
    senderObj.userId ||
    msg.senderId ||
    msg.fromId;

  const text =
    msg.text ||
    msg.content?.text ||
    (typeof msg.content === "string" ? msg.content : "") ||
    "";

  const conversationId =
    msg.conversationId ||
    msg.conversation?._id ||
    (typeof msg.conversation === "string" ? msg.conversation : null);

  const rawReadBy = Array.isArray(msg.readBy) ? msg.readBy : [];
  const readBy = rawReadBy.map((r) => ({
    user: r.user?._id || r.user,
    readAt:
      r.readAt ||
      r.createdAt ||
      r.updatedAt ||
      new Date().toISOString(),
  }));

  return {
    _id: msg._id || `local-${Math.random().toString(36).slice(2)}`,
    sender: senderObj,
    senderId: senderId ? String(senderId) : null,
    text,
    createdAt: msg.createdAt || new Date().toISOString(),
    isMine: !!(me && senderId && String(senderId) === me),
    conversationId,
    readBy,
  };
}

function hasUserRead(message, userId) {
  if (!message || !Array.isArray(message.readBy) || !userId) return false;
  const me = String(userId);
  return message.readBy.some((r) => {
    const id = r.user?._id || r.user;
    return id && String(id) === me;
  });
}

/* ---------------- Component ---------------- */

export default function ChatWindow() {
  const navigate = useNavigate();
  const params = useParams();
  const { user } = useAuth();
  const {
    socket,
    joinConversation,
    leaveConversation,
  } = useSocket();

  const userId = (user && (user._id || user.id || user.userId)) || null;

  const conversationId =
    params.conversationId ||
    params.chatId ||
    params.id ||
    params.conversation ||
    null;

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversation, setLoadingConversation] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [error, setError] = useState("");

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);

  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const reportedReadRef = useRef(new Set());

  const otherUserId = conversation?.otherUserId || null;

  /* ---------------- Auto-scroll ---------------- */
  useEffect(() => {
    if (!bottomRef.current) return;
    const id = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 30);
    return () => clearTimeout(id);
  }, [messages.length]);

  /* ---------------- Reset read tracker ---------------- */
  useEffect(() => {
    reportedReadRef.current = new Set();
  }, [conversationId]);

  /* ---------------- Load Conversation ---------------- */
  useEffect(() => {
    let cancelled = false;

    async function loadConversation() {
      setLoadingConversation(true);
      setError("");

      if (!conversationId || !userId) {
        if (!cancelled) {
          if (!conversationId) setError("Invalid conversation.");
          setConversation(null);
          setLoadingConversation(false);
        }
        return;
      }

      try {
        const conv = await chatService.getConversation(conversationId);
        if (!cancelled) {
          if (!conv || !conv._id) {
            setError("Conversation not found.");
            setConversation(null);
          } else {
            const normalized = normalizeConversation(conv, userId);
            setConversation(normalized);
          }
        }
      } catch (err) {
        console.error("❌ Failed to load conversation:", err);
        if (!cancelled) {
          setError("Failed to load conversation.");
          setConversation(null);
        }
      } finally {
        if (!cancelled) setLoadingConversation(false);
      }
    }

    loadConversation();

    return () => {
      cancelled = true;
    };
  }, [conversationId, userId]);

  /* ---------------- Load Messages ---------------- */
  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      setLoadingMessages(true);

      if (!conversationId || !userId) {
        if (!cancelled) {
          setMessages([]);
          setLoadingMessages(false);
        }
        return;
      }

      try {
        const res = await messageService.getMessages(conversationId, {
          page: 1,
          limit: PAGE_SIZE,
        });

        const raw =
          res?.messages ||
          res?.data?.messages ||
          res?.data?.data?.messages ||
          res?.data?.data ||
          res?.data ||
          [];

        const normalized = (Array.isArray(raw) ? raw : [])
          .map((m) => normalizeMessage(m, userId))
          .filter(Boolean)
          .sort(
            (a, b) =>
              new Date(a.createdAt) - new Date(b.createdAt)
          );

        if (!cancelled) setMessages(normalized);
      } catch (err) {
        console.error("❌ Failed to load messages:", err);
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [conversationId, userId]);

  /* ---------------- Mark visible messages as read ---------------- */
  useEffect(() => {
    if (!socket || !conversationId || !userId) return;

    const me = String(userId);
    const unread = messages.filter(
      (m) =>
        !m.isMine &&
        !hasUserRead(m, me) &&
        !reportedReadRef.current.has(m._id)
    );

    unread.forEach((m) => {
      socket.emit("message:read", {
        messageId: m._id,
        conversationId,
      });
      reportedReadRef.current.add(m._id);
    });
  }, [messages, socket, conversationId, userId]);

  /* ---------------- Socket realtime ---------------- */
  useEffect(() => {
    if (!socket || !conversationId || !userId) return;

    joinConversation && joinConversation(conversationId);

    const handleReceive = (payload) => {
      const conv =
        payload?.conversationId ||
        payload?.conversation?._id ||
        payload?.conversation;

      if (!conv || String(conv) !== String(conversationId)) return;

      const msg = normalizeMessage(payload, userId);
      if (!msg) return;

      setMessages((prev) =>
        [...prev, msg].sort(
          (a, b) =>
            new Date(a.createdAt) - new Date(b.createdAt)
        )
      );
    };

    const handleTyping = (uid) => {
      if (!otherUserId) return;
      if (String(uid) === String(otherUserId)) setIsTyping(true);
    };

    const handleStopTyping = (uid) => {
      if (!otherUserId) return;
      if (String(uid) === String(otherUserId)) setIsTyping(false);
    };

    const handleOnlineUsers = (list) => {
      if (!otherUserId || !Array.isArray(list)) return;
      setIsOnline(list.map(String).includes(String(otherUserId)));
    };

    const handlePresenceUpdate = ({ userId: uid, isOnline, lastSeen }) => {
      if (!uid || !otherUserId) return;
      if (String(uid) !== String(otherUserId)) return;

      setIsOnline(!!isOnline);
      setLastSeen(lastSeen || null);
    };

    const handleReadUpdate = ({ messageId, userId: readerId, readAt }) => {
      if (!messageId || !readerId) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m._id !== messageId) return m;
          const already = (m.readBy || []).some((r) => {
            const id = r.user?._id || r.user;
            return id && String(id) === String(readerId);
          });
          if (already) return m;
          return {
            ...m,
            readBy: [
              ...(m.readBy || []),
              {
                user: readerId,
                readAt: readAt || new Date().toISOString(),
              },
            ],
          };
        })
      );
    };

    socket.on("message:receive", handleReceive);
    socket.on("user:typing", handleTyping);
    socket.on("user:stopTyping", handleStopTyping);
    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("users:online", handleOnlineUsers);
    socket.on("presence:update", handlePresenceUpdate);
    socket.on("message:read:update", handleReadUpdate);

    return () => {
      socket.off("message:receive", handleReceive);
      socket.off("user:typing", handleTyping);
      socket.off("user:stopTyping", handleStopTyping);
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("users:online", handleOnlineUsers);
      socket.off("presence:update", handlePresenceUpdate);
      socket.off("message:read:update", handleReadUpdate);

      leaveConversation && leaveConversation(conversationId);
    };
  }, [
    socket,
    conversationId,
    otherUserId,
    userId,
    joinConversation,
    leaveConversation,
  ]);

  /* ---------------- Send / typing ---------------- */

  const handleSend = () => {
    const text = input.trim();
    if (!text || !conversationId || !socket) return;

    socket.emit("message:send", {
      conversationId,
      content: { text, type: "text" },
    });

    socket.emit("typing:stop", { conversationId });

    setInput("");
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);

    if (!socket || !conversationId) return;

    socket.emit("typing:start", { conversationId });

    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }
    typingTimer.current = setTimeout(() => {
      socket.emit("typing:stop", { conversationId });
    }, 1500);
  };

  /* ---------------- Render states ---------------- */

  if (loadingConversation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-400">
        Loading conversation…
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-400 text-center px-6">
        <p className="mb-3">{error || "Conversation not found."}</p>
        <button
          onClick={() => navigate("/chats")}
          className="px-4 py-2 bg-purple-600 rounded-full text-white text-sm"
        >
          Back to chats
        </button>
      </div>
    );
  }

  /* ---------------- Main UI ---------------- */

  const presenceText = conversation.isGroup
    ? `Group chat · ${conversation.participants?.length || 0} members`
    : isTyping
    ? "typing…"
    : formatLastSeen(isOnline, lastSeen);

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header (sticky at top) */}
      <div className="shrink-0 z-20 flex items-center gap-3 px-4 py-3 bg-gray-950/95 border-b border-gray-800 backdrop-blur">
        <button
          onClick={() => navigate("/chats")}
          className="text-2xl mr-1 leading-none"
        >
          ←
        </button>

        <div className="w-9 h-9 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold">
          {conversation.avatarInitial}
        </div>

        <div className="flex flex-col min-w-0">
          <span className="font-semibold truncate">{conversation.title}</span>
          <span
            className={`text-xs truncate ${
              isTyping
                ? "text-purple-400 animate-pulse"
                : isOnline
                ? "text-green-400"
                : "text-gray-400"
            }`}
          >
            {presenceText}
          </span>
        </div>
      </div>

      {/* Messages (only scroll area) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
        {loadingMessages && messages.length === 0 && (
          <p className="text-center text-gray-500 text-sm">
            Loading messages…
          </p>
        )}

        {!loadingMessages && messages.length === 0 && (
          <p className="text-center text-gray-500 text-sm">
            No messages yet. Say hi! 👋
          </p>
        )}

        {messages.map((msg, index) => {
          const timeLabel = new Date(msg.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          const isRead =
            Array.isArray(msg.readBy) && msg.readBy.length > 0;

          const prev = index > 0 ? messages[index - 1] : null;
          const showDateDivider =
            !prev || !isSameDay(prev.createdAt, msg.createdAt);

          return (
            <Fragment key={msg._id}>
              {showDateDivider && (
                <div className="flex justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-gray-800 text-xs text-gray-300">
                    {formatDateLabel(msg.createdAt)}
                  </span>
                </div>
              )}

              <div
                className={`flex ${
                  msg.isMine ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-snug break-words ${
                    msg.isMine
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-800 text-white rounded-bl-sm"
                  }`}
                >
                  <div>{msg.text}</div>
                  <div className="mt-1 flex items-center justify-end gap-0.5 text-[10px] leading-none">
                    <span className="opacity-80">{timeLabel}</span>
                    {msg.isMine && (
                      <span
                        className={`ml-0.5 tracking-tight ${
                          isRead ? "text-blue-100" : "text-gray-200"
                        }`}
                      >
                        {isRead ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input (sticky at bottom) */}
      <div className="shrink-0 px-3 py-2 bg-gray-950/95 border-t border-gray-800 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-full text-sm outline-none placeholder:text-gray-500"
            placeholder="Type a message…"
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            className="px-4 py-2 bg-purple-600 rounded-full text-sm font-semibold"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
