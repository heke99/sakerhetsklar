"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function MarkAllReadButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/v1/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markAllRead: true }),
          });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Markerar…" : "Markera alla som lästa"}
    </Button>
  );
}

export function NotificationLink({
  notificationId,
  href,
  read,
}: {
  notificationId: string;
  href: string;
  read: boolean;
}) {
  return (
    <Link
      href={href}
      className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
      onClick={() => {
        if (!read) {
          void fetch("/api/v1/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notificationIds: [notificationId] }),
          });
        }
      }}
    >
      Öppna →
    </Link>
  );
}
