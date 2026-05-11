"use client";
import { createContext, useContext, useState, useCallback, useRef } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

type ToastType = "success" | "error";
interface ToastAction { label: string; onClick: () => void }
interface Toast {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
  duration: number;
}
interface ToastCtx {
  toast: (message: string, type?: ToastType, opts?: { action?: ToastAction; duration?: number }) => void;
}

const ToastContext = createContext<ToastCtx>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const toast = useCallback<ToastCtx["toast"]>((message, type = "success", opts) => {
    const id = ++counter.current;
    const duration = opts?.duration ?? (opts?.action ? 5500 : 3500);
    setToasts(prev => [...prev, { id, message, type, action: opts?.action, duration }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* bottom-24 on mobile leaves room above the bottom nav; bottom-5 on desktop */}
      <div className="fixed bottom-24 md:bottom-5 right-3 md:right-5 left-3 md:left-auto z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto animate-toast
              ${t.type === "success" ? "bg-white border border-green-100 text-slate-700" : "bg-white border border-red-100 text-slate-700"}`}
            style={{ minWidth: 280 }}
          >
            {t.type === "success"
              ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                className="text-blue-600 hover:text-blue-700 font-semibold text-sm px-2 py-0.5 rounded-md hover:bg-blue-50 transition-colors"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              className="text-slate-300 hover:text-slate-500 transition-colors ml-0.5"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
