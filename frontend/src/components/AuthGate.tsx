"use client";

import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { getMe, logout } from "@/lib/api";

type Status = "loading" | "authed" | "anon";

export const AuthGate = () => {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    getMe()
      .then((me) => setStatus(me ? "authed" : "anon"))
      .catch(() => setStatus("anon"));
  }, []);

  const handleLogout = async () => {
    await logout();
    setStatus("anon");
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--gray-text)]">
        Loading...
      </div>
    );
  }

  if (status === "anon") {
    return <LoginForm onAuthed={() => setStatus("authed")} />;
  }

  return <KanbanBoard onLogout={handleLogout} />;
};
