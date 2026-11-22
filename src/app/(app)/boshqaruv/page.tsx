import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminManager, type UserRow } from "@/components/AdminManager";

export const metadata: Metadata = { title: "Бошқарув" };


export default async function BoshqaruvPage() {
  const viewer = await requireViewer();
  if (!viewer.isSuperAdmin) redirect("/korish");
  const supabase = await createClient();
  const [profiles, grants] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role, is_blocked, created_at").order("created_at"),
    supabase.from("role_grants").select("email, full_name, role"),
  ]);

  const rows: UserRow[] = (profiles.data ?? []).map((p) => ({ ...p, pending: false }));
  for (const g of grants.data ?? []) {
    if (!rows.some((r) => r.email === g.email)) rows.push({ id: null, email: g.email, full_name: g.full_name, role: g.role, is_blocked: false, created_at: null, pending: true });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900 dark:text-white">Бошқарув</h1>
        <p className="text-sm text-muted">Админлар брон киритади. Қолганлар фақат кўради. Бош админ: {viewer.email}</p>
      </div>
      <AdminManager rows={rows} selfId={viewer.id} />
    </div>
  );
}
