"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Locale, t } from "@/lib/i18n";

type Props = {
  username: string;
  locale: Locale;
};

export function UserDeleteButton({ username, locale }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function deleteUser() {
    const confirmed = window.confirm(t(locale, "deleteConfirm", { username }));
    if (!confirmed) return;

    const response = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      window.alert(payload?.error ?? t(locale, "deleteFailed"));
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <button className="danger-button compact-button" disabled={isPending} onClick={deleteUser} type="button">
      {isPending ? t(locale, "deleting") : t(locale, "delete")}
    </button>
  );
}
