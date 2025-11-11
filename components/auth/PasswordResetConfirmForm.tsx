"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PasswordResetConfirmForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("idle");
    setMessage("");
    try {
      const response = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "Reset failed");
      }
      setStatus("success");
      setMessage("Password updated. You can now sign in.");
    } catch (error: any) {
      setStatus("error");
      setMessage(error?.message ?? "Reset failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-password">New password</Label>
        <Input
          id="reset-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
        />
      </div>
      {message ? (
        <p className={`text-sm ${status === "error" ? "text-red-600" : "text-slate-600"}`}>{message}</p>
      ) : null}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}
