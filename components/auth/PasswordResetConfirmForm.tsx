"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PasswordResetConfirmForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordsFilled = password.length > 0 && confirmPassword.length > 0;
  const passwordsMatch = passwordsFilled && password === confirmPassword;
  const formValid = password.length >= 8 && confirmPassword.length >= 8 && passwordsMatch;

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (isSubmitting || !formValid) return;
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
      router.push("/login?reset=success");
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
      <div className="space-y-2">
        <Label htmlFor="reset-password-confirm">Confirm password</Label>
        <Input
          id="reset-password-confirm"
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Re-enter password"
        />
        {passwordsFilled ? (
          <p className={`text-xs ${passwordsMatch ? "text-emerald-600" : "text-red-600"}`}>
            {passwordsMatch ? "Passwords match" : "Passwords do not match"}
          </p>
        ) : (
          <p className="text-xs text-slate-500">Both fields must match and be at least 8 characters.</p>
        )}
      </div>
      {message ? <p className={`text-sm ${status === "error" ? "text-red-600" : "text-slate-600"}`}>{message}</p> : null}
      <Button type="submit" disabled={isSubmitting || !formValid} className="w-full">
        {isSubmitting ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}
