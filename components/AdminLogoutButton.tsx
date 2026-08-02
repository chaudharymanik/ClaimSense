"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Drops only the admin credential, back to the regular claims dashboard — not a full logout. */
export default function AdminLogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/claims");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleLogout} disabled={loading} className={className}>
      {loading ? "Logging out…" : "Admin logout"}
    </button>
  );
}
