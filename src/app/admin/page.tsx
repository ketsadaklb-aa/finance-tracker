"use client";
import { useEffect, useState } from "react";
import { UserPlus, Trash2, Ban, CheckCircle, KeyRound, Shield } from "lucide-react";

type User = { id: string; username: string; name: string; role: string; isBlocked: boolean };
type Account = { id: string; name: string; type: string };

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accessMap, setAccessMap] = useState<Record<string, string[]>>({}); // accountId -> userIds[]
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: "", name: "", password: "" });
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "access">("users");

  async function load() {
    const [u, a] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]);
    setUsers(u);
    setAccounts(a);

    const map: Record<string, string[]> = {};
    await Promise.all(
      a.map(async (acc: Account) => {
        const ids = await fetch(`/api/admin/accounts/${acc.id}/access`).then((r) => r.json());
        map[acc.id] = ids;
      })
    );
    setAccessMap(map);
  }

  useEffect(() => { load(); }, []);

  async function createUser() {
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setForm({ username: "", name: "", password: "" });
    setShowCreate(false);
    load();
  }

  async function toggleBlock(user: User) {
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBlocked: !user.isBlocked }),
    });
    load();
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleAccess(accountId: string, userId: string) {
    const current = accessMap[accountId] ?? [];
    const updated = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    await fetch(`/api/admin/accounts/${accountId}/access`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: updated }),
    });
    setAccessMap((prev) => ({ ...prev, [accountId]: updated }));
  }

  const members = users.filter((u) => u.role === "member");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin Panel</h1>
          <p className="text-slate-500 text-sm">Manage team members and account visibility</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {(["users", "access"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "users" ? "Team Members" : "Account Access"}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{members.length} member{members.length !== 1 ? "s" : ""}</p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Add Member
            </button>
          </div>

          {showCreate && (
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
              <h3 className="font-medium text-slate-700">New Team Member</h3>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="grid grid-cols-3 gap-3">
                <input
                  placeholder="Username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  placeholder="Display name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={createUser} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">Create</button>
                <button onClick={() => { setShowCreate(false); setError(""); }} className="text-slate-600 text-sm px-4 py-2 rounded-lg hover:bg-slate-200">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {members.map((user) => (
              <div key={user.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3">
                <div>
                  <p className="font-medium text-slate-800">{user.name}</p>
                  <p className="text-slate-500 text-sm">@{user.username}</p>
                </div>
                <div className="flex items-center gap-2">
                  {user.isBlocked && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">Blocked</span>
                  )}
                  <button
                    onClick={() => toggleBlock(user)}
                    title={user.isBlocked ? "Unblock" : "Block"}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-amber-600 transition-colors"
                  >
                    {user.isBlocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteUser(user.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-center text-slate-400 py-8">No team members yet. Add one above.</p>
            )}
          </div>
        </div>
      )}

      {/* Account Access Tab */}
      {activeTab === "access" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Check which members can see each account. Admin always sees all accounts.</p>
          {accounts.length === 0 && (
            <p className="text-center text-slate-400 py-8">No accounts yet. Create accounts first.</p>
          )}
          {accounts.map((account) => (
            <div key={account.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="w-4 h-4 text-slate-400" />
                <span className="font-medium text-slate-800">{account.name}</span>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{account.type}</span>
              </div>
              {members.length === 0 ? (
                <p className="text-sm text-slate-400">No members to assign.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {members.map((user) => {
                    const hasAccess = (accessMap[account.id] ?? []).includes(user.id);
                    return (
                      <label key={user.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasAccess}
                          onChange={() => toggleAccess(account.id, user.id)}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <span className="text-sm text-slate-700">{user.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
