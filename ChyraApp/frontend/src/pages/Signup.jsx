import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import authService from "../services/authService";
import "../styles/authBackground.css";

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authService.register(form);
      navigate("/chats");
    } catch (err) {
      alert(err.message || "Signup failed");
    }

    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Join ChyraApp today ✨</p>

        <form onSubmit={handleSignup}>
          <input
            name="name"
            placeholder="Full Name"
            className="auth-input"
            onChange={handleChange}
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            className="auth-input"
            onChange={handleChange}
            required
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            className="auth-input"
            onChange={handleChange}
            required
          />

          <button className="auth-button">
            {loading ? "Creating..." : "Sign Up"}
          </button>
        </form>

        <div className="auth-bottom-text">
          Already have an account?
          <span className="auth-link" onClick={() => navigate("/login")}>
            Login
          </span>
        </div>
      </div>
    </div>
  );
}
