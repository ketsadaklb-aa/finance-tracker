"use client";
import { useEffect, useRef } from "react";
import { Task, dueYmd, ymd } from "./types";

// Fires a browser notification for tasks that are due today or overdue, once
// each per session. Works while any app tab is open (no server push yet).
export function useReminders(tasks: Task[], enabled: boolean) {
  const notified = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const check = () => {
      const today = ymd(new Date());
      for (const t of tasks) {
        if (t.status === "done" || !t.dueDate) continue;
        const d = dueYmd(t.dueDate)!;
        if (d <= today && !notified.current.has(t.id)) {
          notified.current.add(t.id);
          new Notification(d < today ? "⏰ Task overdue" : "📌 Due today", {
            body: t.title + (t.dueTime ? ` · ${t.dueTime}` : ""),
          });
        }
      }
    };
    check();
    const iv = setInterval(check, 60_000);
    return () => clearInterval(iv);
  }, [tasks, enabled]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  return (await Notification.requestPermission()) === "granted";
}
