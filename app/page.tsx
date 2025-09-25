"use client";

import { useState, useEffect } from "react";
import Order from "./order"; // dein Formular

const PASSWORD = "omicron"; // später ENV

export default function ProtectedPage() {
  const [input, setInput] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("auth") === "1") {
      setAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    if (input === PASSWORD) {
      setAuthenticated(true);
      localStorage.setItem("auth", "1");
    } else {
      alert("❌ Wrong password");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("auth");
    setAuthenticated(false);
  };

  if (!authenticated) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="p-6 rounded-lg shadow-md bg-white w-80">
          <h1 className="text-lg font-semibold mb-4">Login</h1>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter password"
            className="border rounded w-full p-2 mb-4"
          />
          <button
            onClick={handleLogin}
            className="cursor-pointer w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  // 🔓 eingeloggt → Formular + Logout
  return (
    <div className="relative">
      {/* Logout Button rechts oben */}
      <button
        onClick={handleLogout}
        className="cursor-pointer absolute top-4 right-4 bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm"
      >
        Logout
      </button>

      <Order />
    </div>
  );
}