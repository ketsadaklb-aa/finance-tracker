"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, Plus, LogOut, User, CornerDownLeft, ArrowUp, ArrowDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { visibleGroups, openAddTransaction } from "./nav-config";
import { useUser, initials } from "./user-context";

type Command = {
  id: string;
  group: "Actions" | "Go to" | "Contacts";
  label: string;
  hint?: string;
  icon?: LucideIcon;
  avatar?: string;
  keywords?: string;
  run: () => void;
};

type Contact = { id: string; name: string; phone?: string | null };

/** Score how well `q` matches `text`: prefix > word-prefix > substring > in-order fuzzy. 0 = no match. */
function score(text: string, q: string): number {
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t.startsWith(q)) return 4;
  if (t.split(/[\s/·-]+/).some(w => w.startsWith(q))) return 3;
  if (t.includes(q)) return 2;
  if (q.length < 3) return 0; // in-order fuzzy is too noisy for 1–2 letters
  let i = 0;
  for (const ch of t) if (ch === q[i]) i++;
  return i === q.length ? 1 : 0;
}

/**
 * ⌘K / Ctrl+K command palette — jump to any page, find a contact's ledger,
 * or run a quick action. Also opened via the "openCommandPalette" window event.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const user = useUser();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("openCommandPalette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("openCommandPalette", onOpen);
    };
  }, []);

  // Lazy-load contacts the first time the palette opens
  useEffect(() => {
    if (!open || contacts !== null) return;
    fetch("/api/contacts")
      .then(r => (r.ok ? r.json() : []))
      .then(d => setContacts(Array.isArray(d) ? d : []))
      .catch(() => setContacts([]));
  }, [open, contacts]);

  useEffect(() => { if (!open) { setQuery(""); setActiveIdx(0); } }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    const list: Command[] = [];
    if (isAdmin) {
      list.push({
        id: "add-tx", group: "Actions", label: "Add transaction", icon: Plus, keywords: "new income expense record",
        run: () => openAddTransaction(pathname, router.push),
      });
    }
    list.push({
      id: "logout", group: "Actions", label: "Sign out", icon: LogOut, keywords: "logout exit",
      run: async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); },
    });
    for (const g of visibleGroups(isAdmin)) {
      for (const item of g.items) {
        list.push({ id: `nav:${item.href}`, group: "Go to", label: item.label, hint: g.title, icon: item.icon, keywords: item.keywords, run: go(item.href) });
      }
    }
    for (const c of contacts ?? []) {
      list.push({
        id: `contact:${c.id}`, group: "Contacts", label: c.name, hint: c.phone ?? "Open ledger", avatar: initials(c.name),
        run: go(`/ledger?contact=${c.id}`),
      });
    }
    return list;
  }, [isAdmin, contacts, pathname, router]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored = commands
      .map(c => ({ c, s: Math.max(score(c.label, q), q && score(c.keywords ?? "", q) >= 3 ? 1.5 : 0) }))
      .filter(x => x.s > 0);
    // Without a query, keep contacts out of the way (show a handful)
    const visible = q ? scored.sort((a, b) => b.s - a.s) : scored.filter((x, i, arr) =>
      x.c.group !== "Contacts" || arr.slice(0, i).filter(y => y.c.group === "Contacts").length < 5);
    const order = ["Actions", "Go to", "Contacts"] as const;
    return order.flatMap(g => visible.filter(x => x.c.group === g).map(x => x.c));
  }, [commands, query]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${activeIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  function run(cmd: Command | undefined) {
    if (!cmd) return;
    setOpen(false);
    cmd.run();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); run(results[activeIdx]); }
  }

  let lastGroup = "";
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="sheet-overlay fixed inset-0 z-[70] bg-slate-900/25 backdrop-blur-[3px]" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className="palette-in fixed left-1/2 top-[12vh] z-[70] w-[calc(100%-1.5rem)] max-w-xl rounded-3xl bg-white/90 backdrop-blur-2xl border border-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200/70 overflow-hidden"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search pages, contacts and actions</DialogPrimitive.Description>
          <div className="flex items-center gap-3 px-5 h-14 border-b border-slate-100">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search pages, contacts, actions…"
              className="flex-1 bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 outline-none focus:outline-none !shadow-none"
            />
            <kbd className="hidden sm:block text-[10px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5">ESC</kbd>
          </div>

          <div ref={listRef} className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
            {results.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-10">No results for “{query}”</p>
            )}
            {results.map((cmd, idx) => {
              const header = cmd.group !== lastGroup ? cmd.group : null;
              lastGroup = cmd.group;
              const Icon = cmd.icon ?? User;
              const active = idx === activeIdx;
              return (
                <div key={cmd.id}>
                  {header && (
                    <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{header}</p>
                  )}
                  <button
                    data-idx={idx}
                    onClick={() => run(cmd)}
                    onMouseMove={() => setActiveIdx(idx)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl px-3 h-11 text-left text-sm transition-colors",
                      active ? "bg-indigo-50 text-indigo-900" : "text-slate-700"
                    )}
                  >
                    {cmd.avatar ? (
                      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 text-[10px] font-semibold flex items-center justify-center shrink-0">
                        {cmd.avatar}
                      </span>
                    ) : (
                      <span className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        active ? "bg-brand text-white shadow-sm shadow-indigo-500/30" : "bg-slate-100 text-slate-500"
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <span className="flex-1 truncate font-medium">{cmd.label}</span>
                    {cmd.hint && <span className="text-xs text-slate-400 truncate max-w-[40%]">{cmd.hint}</span>}
                    {active && <CornerDownLeft className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="hidden sm:flex items-center gap-4 px-5 h-10 border-t border-slate-100 text-[11px] text-slate-400 bg-slate-50/60">
            <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> navigate</span>
            <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> open</span>
            <span className="ml-auto">⌘K to toggle</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
