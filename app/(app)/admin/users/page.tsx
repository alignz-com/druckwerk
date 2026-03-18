import AdminUsersView from "@/components/admin/users/AdminUsersView";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  return <AdminUsersView autoOpen={params.new === "1"} />;
}
