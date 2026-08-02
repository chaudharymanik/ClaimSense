"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleLogout} disabled={loading} className={className}>
      {children ?? (loading ? "Logging out…" : "Logout")}
    </button>
  );
}
