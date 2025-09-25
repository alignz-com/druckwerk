"use client";

import { useState, useEffect } from "react";
import Order from "./order"; // 👈 neuer Name

const PASSWORD = "omicron"; // 🔑 später als ENV-Variable

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
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  // 🔓 wenn eingeloggt → zeig Order-Formular
  return <Order />;
}