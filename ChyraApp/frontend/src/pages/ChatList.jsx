// frontend/src/pages/ChatList.jsx
// 🔥 Fully optimized, loop-proof, realtime-ready Chat List for ChyraApp

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import chatService from "../services/chatService";

export default function ChatList() {
  const { user } = useAuth();
  const socket = useSocket()?.socket;
  const navigate = useNavigate();

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = user?._id || user?.id || null;

  // Prevent infinite reload loops
  const hasLoadedRef = useRef(false);

  // -------------------------------------------------------------
  // 🎯 Normalize conversation for frontend use
  // -------------------------------------------------------------
  const normalizeConversation = (conv) => {
    if (!conv || typeof conv !== "object") return null;
    if (!conv._id) return null;

    const isGroup = !!conv.isGroup;

    const participants = Array.isArray(conv.participants)
      ? conv.participants
          .map((p) => (p.user ? p.user : p))
          .filter((p) => p && p._id)
      : [];

    let displayName = "Unknown Chat";
    let avatarInitial = "C";

    if (isGroup) {
      displayName =
        conv.name || conv.groupName || conv.groupDescription || "Group Chat";
      avatarInitial = displayName[0]?.toUpperCase() || "G";
    } else {
      const other = participants.find((p) => p._id !== userId);
      displayName =
        other?.fullName || other?.username || other?.email || "Unknown User";
      avatarInitial = displayName[0]?.toUpperCase() || "U";
    }

    const lastMsgText =
      conv.lastMessage?.text ||
      conv.lastMessage?.content ||
      "Tap to start chatting";

    const time = conv.lastMessage?.createdAt || conv.lastMessageAt || null;
    const unreadCount = conv.unreadCount || 0;

    return {
      ...conv,
      isGroup,
      participants,
      displayName,
      avatarInitial,
      lastMsg: lastMsgText,
      time,
      unreadCount,
    };
  };

  // -------------------------------------------------------------
  // 🚀 Load Chats Once (fixed infinite loop)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!userId) return;

    if (hasLoadedRef.current) return; // prevent loop
    hasLoadedRef.current = true;

    async function load() {
      try {
        const { success, conversations } = await chatService.getUserChats();
        const raw = success ? conversations : [];

        console.log("🔥 Raw conversations:", raw);

        const normalized = raw
          .map(normalizeConversation)
          .filter(Boolean)
          .sort((a, b) => {
            const tA = a.time ? new Date(a.time).getTime() : 0;
            const tB = b.time ? new Date(b.time).getTime() : 0;
            return tB - tA;
          });

        console.log("📌 Normalized ChatList:", normalized);

        setChats(normalized);
      } catch (err) {
        console.error("❌ ChatList load error:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [userId]);

  // -------------------------------------------------------------
  // 🔄 Realtime updates: new messages + conversation creation
  // -------------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const onMessageReceive = (msg) => {
      if (!msg?.conversationId) return;

      const text = msg.text || msg.content || "";
      const createdAt = msg.createdAt || new Date().toISOString();

      setChats((prev) => {
        const copy = [...prev];
        const i = copy.findIndex((c) => c._id === msg.conversationId);

        if (i !== -1) {
          copy[i] = {
            ...copy[i],
            lastMsg: text,
            time: createdAt,
          };

          // Move chat to top
          const updated = copy.splice(i, 1)[0];
          return [updated, ...copy];
        }

        return prev;
      });
    };

    const onConversationCreate = (conv) => {
      const normalized = normalizeConversation(conv);
      if (!normalized) return;

      setChats((prev) => {
        if (prev.some((c) => c._id === normalized._id)) return prev;
        return [normalized, ...prev];
      });
    };

    const onConversationUpdate = (conv) => {
      const normalized = normalizeConversation(conv);
      if (!normalized) return;

      setChats((prev) =>
        prev.map((c) => (c._id === normalized._id ? normalized : c))
      );
    };

    socket.on("message:receive", onMessageReceive);
    socket.on("conversation:create", onConversationCreate);
    socket.on("conversation:update", onConversationUpdate);

    return () => {
      socket.off("message:receive", onMessageReceive);
      socket.off("conversation:create", onConversationCreate);
      socket.off("conversation:update", onConversationUpdate);
    };
  }, [socket, userId]);

  // -------------------------------------------------------------
  // 🧭 Navigation
  // -------------------------------------------------------------
  const openChat = (id) => {
    if (!id || id === "null" || id === "undefined") {
      console.warn("⚠️ Invalid conversation id:", id);
      return;
    }
    navigate(`/chats/${id}`);
  };

  const isEmpty = useMemo(() => chats.length === 0, [chats]);

  // -------------------------------------------------------------
  // UI RENDER
  // -------------------------------------------------------------
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-gray-400">
        Loading your conversations…
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-gray-400 px-6 text-center">
        No conversations yet. Start chatting!
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 text-white overflow-y-auto">
      {chats.map((chat) => (
        <div
          key={chat._id}
          onClick={() => openChat(chat._id)}
          className="flex items-center gap-4 p-4 border-b border-gray-800 hover:bg-gray-800 active:bg-gray-700 cursor-pointer transition-colors"
        >
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-lg font-bold">
              {chat.avatarInitial}
            </div>

            {chat.isGroup && (
              <span className="absolute -bottom-1 -right-1 bg-gray-900 text-[10px] px-1.5 py-0.5 rounded-full border border-purple-400">
                Group
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold truncate">{chat.displayName}</h2>
              {chat.time && (
                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                  {new Date(chat.time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>

            <div className="flex justify-between items-center mt-1">
              <span className="text-gray-400 text-sm truncate">
                {chat.lastMsg}
              </span>

              {chat.unreadCount > 0 && (
                <span className="flex-shrink-0 min-w-[22px] h-[22px] bg-green-500 text-gray-900 rounded-full text-[11px] font-bold flex items-center justify-center">
                  {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
