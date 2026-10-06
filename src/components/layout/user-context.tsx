"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type SessionUser = { name: string; role: string };

const UserContext = createContext<SessionUser | null>(null);

/** Fetches /api/auth/me once and shares it with the sidebar, mobile nav, and command palette. */
export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setUser(d); })
      .catch(() => {});
  }, []);
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join("") || "?";
}
