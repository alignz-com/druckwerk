"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PasswordResetRequestForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("idle");
    setMessage("");
    try {
      const response = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        throw new Error("Request failed");
      }
      setStatus("success");
      setMessage("If that email exists, a reset link was sent.");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </div>
      {message ? (
        <p className={`text-sm ${status === "error" ? "text-red-600" : "text-slate-600"}`}>{message}</p>
      ) : null}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
