import PasswordResetRequestForm from "@/components/auth/PasswordResetRequestForm";

export default function PasswordResetPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6 py-16">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>
        <p className="text-sm text-slate-600">Enter your email and we&apos;ll send you a reset link.</p>
      </div>
      <PasswordResetRequestForm />
    </div>
  );
}
