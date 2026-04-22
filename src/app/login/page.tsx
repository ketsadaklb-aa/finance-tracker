"use client";
import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Invalid username or password");
      setLoading(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex flex-col justify-center items-center w-[480px] shrink-0 relative overflow-hidden"
        style={{ background: "linear-gradient(150deg,#0f2352 0%,#1a3a6e 50%,#0d1b3e 100%)" }}
      >
        {/* decorative blobs */}
        <div className="absolute top-[-80px] left-[-80px] w-64 h-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle,#60a5fa,transparent)" }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-72 h-72 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle,#818cf8,transparent)" }} />

        <div className="relative z-10 flex flex-col items-center text-center px-12 gap-10">
          {/* logo */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/40 flex items-center justify-center">
              <span className="text-white text-2xl font-bold">₭</span>
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold tracking-tight">Catdy&apos;s</h1>
              <p className="text-blue-300 text-sm font-medium mt-0.5">AR AP Tracker</p>
            </div>
          </div>

          {/* decorative summary cards */}
          <div className="w-full space-y-3">
            {[
              { label: "Receivables", value: "AR", color: "from-green-500/20 to-green-600/10", border: "border-green-500/30", dot: "bg-green-400" },
              { label: "Payables",    value: "AP", color: "from-red-500/20 to-red-600/10",   border: "border-red-500/30",   dot: "bg-red-400"   },
              { label: "Multi-Currency", value: "LAK · THB · USD", color: "from-blue-500/20 to-blue-600/10", border: "border-blue-500/30", dot: "bg-blue-400" },
            ].map(c => (
              <div key={c.label}
                className={`flex items-center justify-between bg-gradient-to-r ${c.color} border ${c.border} rounded-xl px-4 py-3`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                  <span className="text-blue-100 text-sm font-medium">{c.label}</span>
                </div>
                <span className="text-white text-xs font-mono bg-white/10 px-2.5 py-1 rounded-lg">{c.value}</span>
              </div>
            ))}
          </div>

          <p className="text-blue-400/70 text-xs">© {new Date().getFullYear()} Catdy&apos;s AR AP Tracker</p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center bg-slate-100 px-6">
        <div className="w-full max-w-[400px]">

          {/* mobile logo */}
          <div className="flex lg:hidden flex-col items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md">
              <span className="text-white text-xl font-bold">₭</span>
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-800">Catdy&apos;s AR AP Tracker</p>
            </div>
          </div>

          {/* card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200 p-8">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
              <p className="text-slate-400 text-sm mt-1">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter username"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter password"
                  required
                />
              </div>

              {error && (
                <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm shadow-md shadow-blue-500/20 mt-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Signing in…
                  </span>
                ) : "Sign In"}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
