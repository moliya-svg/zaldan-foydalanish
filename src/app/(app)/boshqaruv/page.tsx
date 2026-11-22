import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/dates";
import { AdminManager, type UserRow } from "@/components/AdminManager";

export const metadata: Metadata = { title: "Бошқарув" };

const ACTION_LABEL: Record<string, string> = { create: "Брон киритди", update: "Бронни ўзгартирди", cancel: "Бронни бекор қилди", delete: "Бронни ўчирди", set_role: "Рол берди" };

export default async function BoshqaruvPage() {
  const viewer = await requireViewer();
  if (!viewer.isSuperAdmin) redirect("/korish");
  const supabase = await createClient();
  const [profiles, grants, audit] = await Promise.all([
    supabase.from("profiles").select("id, email, role, is_blocked, created_at").order("created_at"),
    supabase.from("role_grants").select("email, role"),
    supabase.from("audit_log").select("id, action, details, created_at, profiles(email)").order("created_at", { ascending: false }).limit(40),
  ]);

  const rows: UserRow[] = (profiles.data ?? []).map((p) => ({ ...p, pending: false }));
  for (const g of grants.data ?? []) {
    if (!rows.some((r) => r.email === g.email)) rows.push({ id: null, email: g.email, role: g.role, is_blocked: false, created_at: null, pending: true });
  }
  type AuditRow = { id: number; action: string; details: Record<string, unknown> | null; created_at: string; profiles: { email: string } | null };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900 dark:text-white">Бошқарув</h1>
        <p className="text-sm text-muted">Админлар брон киритади. Қолганлар фақат кўради. Бош админ: {viewer.email}</p>
      </div>
      <AdminManager rows={rows} selfId={viewer.id} />
      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 font-semibold">Ўзгаришлар журнали</h2>
        <ul className="divide-y divide-[var(--line)] text-sm">
          {((audit.data ?? []) as unknown as AuditRow[]).map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-3 px-4 py-2">
              <span className="w-36 shrink-0 tabular-nums text-muted">{fmtDateTime(a.created_at)}</span>
              <span className="font-medium">{a.profiles?.email ?? "—"}</span>
              <span>{ACTION_LABEL[a.action] ?? a.action}</span>
              <span className="truncate text-muted">
                {a.details && typeof a.details === "object" ? String(a.details.organization ?? a.details.email ?? a.details.reason ?? "") : ""}
              </span>
            </li>
          ))}
          {!audit.data?.length && <li className="px-4 py-6 text-center text-muted">Ҳали ёзув йўқ.</li>}
        </ul>
      </section>
    </div>
  );
}
