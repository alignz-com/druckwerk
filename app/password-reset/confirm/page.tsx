import PasswordResetConfirmForm from "@/components/auth/PasswordResetConfirmForm";

export default async function PasswordResetConfirmPage({ searchParams: sp }: { searchParams: Promise<{ token?: string }> }) {
  const searchParams = await sp;
  const token = searchParams?.token || "";
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6 py-16">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="text-sm text-slate-600">Enter a new password for your account.</p>
      </div>
      {token ? (
        <PasswordResetConfirmForm token={token} />
      ) : (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          Reset link invalid. Please request a new one.
        </p>
      )}
    </div>
  );
}
