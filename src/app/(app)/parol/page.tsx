import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Паролни ўзгартириш" };

export default async function ParolPage() {
  const viewer = await requireViewer();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-bold">Паролни ўзгартириш</h1>
        <p className="text-sm text-muted">{viewer.email} учун янги пароль. Кейинги сафар шу пароль билан кирасиз.</p>
      </div>
      <PasswordForm />
    </div>
  );
}
