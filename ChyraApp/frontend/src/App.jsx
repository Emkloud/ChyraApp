import React from "react";
import { Routes, Route } from "react-router-dom";

// Existing pages from your project
import Login from "./pages/Login";
import Signup from "./pages/Signup";

import ChatList from "./pages/ChatList";
import ChatWindow from "./pages/ChatWindow";

// If you have any others, import them here manually
// Example:
// import Profile from "./pages/Profile";

function App() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Chats */}
      <Route path="/chats" element={<ChatList />} />
      <Route path="/chats/:id" element={<ChatWindow />} />
      <Route path="/chat/:id" element={<ChatWindow />} />

      {/* Add more later as you build them */}
      {/* Example: <Route path="/profile" element={<Profile />} /> */}
    </Routes>
  );
}

export default App;
