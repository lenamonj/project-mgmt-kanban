"use client";

import { useEffect, useState } from "react";
import { Workspace } from "@/components/Workspace";
import { LoginForm } from "@/components/LoginForm";
import { getMe, logout } from "@/lib/api";

type Status = "loading" | "authed" | "anon";

export const AuthGate = () => {
  const [status, setStatus] = useState<Status>("loading");
  const [username, setUsername] = useState<string | null>(null);

  const refreshMe = () =>
    getMe()
      .then((me) => {
        setUsername(me?.username ?? null);
        setStatus(me ? "authed" : "anon");
      })
      .catch(() => setStatus("anon"));

  useEffect(() => {
    refreshMe();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setUsername(null);
      setStatus("anon");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--gray-text)]">
        Loading...
      </div>
    );
  }

  if (status === "anon") {
    return <LoginForm onAuthed={refreshMe} />;
  }

  return <Workspace username={username} onLogout={handleLogout} />;
};
