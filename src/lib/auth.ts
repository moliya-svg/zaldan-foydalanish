import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Viewer } from "./types";

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, is_blocked")
    .eq("id", user.id)
    .single();
  if (!profile || profile.is_blocked) return null;
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    isAdmin: profile.role === "admin" || profile.role === "super_admin",
    isSuperAdmin: profile.role === "super_admin",
  };
});

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/auth/blocked");
  return v;
}

export async function requireAdmin(): Promise<Viewer> {
  const v = await requireViewer();
  if (!v.isAdmin) redirect("/korish");
  return v;
}
