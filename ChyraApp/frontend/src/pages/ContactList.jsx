// frontend/src/pages/ContactList.jsx
// 👥 Modern, stable, backend-aligned contact picker for 1-on-1 chats

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import chatService from "../services/chatService";
import client from "../services/api";

export default function ContactList() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = user?._id || user?.id || null;

  /** 🔹 Load contact list from backend */
  useEffect(() => {
    if (!userId) return;

    async function loadContacts() {
      setLoading(true);

      try {
        const res = await client.get("/users");

        // Backend shape support:
        const rawUsers =
          res?.data?.data?.users ||
          res?.data?.users ||
          [];

        const cleaned = rawUsers
          .filter((u) => u && u._id && u._id !== userId)
          .map((u) => ({
            id: u._id,
            fullName: u.fullName || u.username || "Unknown User",
            username: u.username || "",
            avatarInitial: (u.fullName || u.username || "U")[0].toUpperCase(),
          }));

        setContacts(cleaned);
      } catch (err) {
        console.error("❌ ContactList loadContacts error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadContacts();
  }, [userId]);

  /** 🔹 Start a new chat */
  const startChat = async (otherUserId) => {
    try {
      const convo = await chatService.createDirectMessage(otherUserId);

      const convoId = convo?._id || convo?.id;
      if (!convoId) {
        console.error("❌ createDirectMessage returned no conversation ID");
        return;
      }

      navigate(`/chats/${convoId}`);
    } catch (err) {
      console.error("❌ Failed to start chat:", err);
    }
  };

  // ===== UI STATES =====

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-gray-400">
        Loading contacts…
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-gray-400 px-6 text-center">
        No other users found.<br />Invite someone to ChyraApp!
      </div>
    );
  }

  // ===== MAIN UI =====

  return (
    <div className="h-screen bg-gray-900 text-white overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gray-900 px-4 py-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold">Contacts</h1>
        <p className="text-xs text-gray-400">Tap a contact to start chatting</p>
      </div>

      {/* Contact List */}
      {contacts.map((c) => (
        <div
          key={c.id}
          onClick={() => startChat(c.id)}
          className="flex items-center gap-4 p-4 border-b border-gray-800 hover:bg-gray-800 cursor-pointer active:bg-gray-700 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
            {c.avatarInitial}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{c.fullName}</div>
            {c.username && (
              <div className="text-xs text-gray-400">@{c.username}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
