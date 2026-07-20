import React, { useCallback, useEffect, useState } from "react";
import { ShieldCheck, LogOut, ArrowLeft, RefreshCw } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { formatCoins, timeAgo } from "../../lib/format";

// Admin dashboard wired to the EXISTING backend /api/admin/* endpoints.
// Access is enforced server-side (requireAdmin: telegram-id allow-list) on every call.

interface AdminStats {
  users: number;
  totalCoins: number;
  pendingWithdrawals: number;
  pendingWithdrawalCoins: number;
  confirmedAdsToday: number;
  flaggedUsers: number;
}
interface AdminWithdrawal {
  id: number;
  user_id: number;
  amount: number;
  method: string;
  destination: string;
  status: string;
  reject_reason: string | null;
  created_at: string;
  telegram_id: number;
  username: string | null;
  shadow_banned: boolean;
}
interface AdminUser {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  balance: number;
  referred_by: number | null;
  streak_days: number;
  shadow_banned: boolean;
  banned: boolean;
  created_at: string;
}

interface Props {
  onLogout: () => void;
}

export const MyAdmin: React.FC<Props> = ({ onLogout }) => {
  const [tab, setTab] = useState<"overview" | "withdrawals" | "users">("overview");
  const tabs = ["overview", "withdrawals", "users"] as const;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span className="font-extrabold tracking-tight text-sm md:text-base">AcEarn Admin</span>
        </div>
        <nav className="flex items-center gap-1 bg-slate-950 rounded-xl p-1 border border-slate-800">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition cursor-pointer ${
                tab === t ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a href="#/dashboard" className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> App
          </a>
          <button onClick={onLogout} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer">
            <LogOut className="w-3.5 h-3.5" /> Exit
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-6">
        {tab === "overview" && <Overview />}
        {tab === "withdrawals" && <Withdrawals />}
        {tab === "users" && <UsersAdmin />}
      </main>
    </div>
  );
};

const Overview: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get<AdminStats>("/api/admin/stats")
      .then((r) => setStats(r.data))
      .catch((e) => setErr(apiErrorMessage(e)));
  }, []);

  if (err) return <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">{err}</div>;
  if (!stats) return <div className="text-slate-400 text-sm">Loading…</div>;

  const cards: [string, string][] = [
    ["Total users", formatCoins(stats.users)],
    ["Coins in circulation", formatCoins(stats.totalCoins)],
    ["Pending withdrawals", formatCoins(stats.pendingWithdrawals)],
    ["Pending coins", formatCoins(stats.pendingWithdrawalCoins)],
    ["Confirmed ads today", formatCoins(stats.confirmedAdsToday)],
    ["Flagged users", formatCoins(stats.flaggedUsers)],
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {cards.map(([label, value]) => (
        <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-2xl font-black text-emerald-400 tracking-tight">{value}</div>
          <div className="text-[11px] text-slate-400 mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
};

const Withdrawals: React.FC = () => {
  const [items, setItems] = useState<AdminWithdrawal[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ items: AdminWithdrawal[] }>("/api/admin/withdrawals");
      setItems(r.data.items);
      setErr(null);
    } catch (e) {
      setErr(apiErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function review(id: number, action: "approve" | "reject", rejReason?: string) {
    setBusy(id);
    setMsg(null);
    try {
      await api.post(`/api/admin/withdrawals/${id}/review`, { action, reason: rejReason });
      setMsg(action === "approve" ? `#${id} approved.` : `#${id} rejected — escrow refunded.`);
      setRejectId(null);
      setReason("");
      await load();
    } catch (e) {
      setMsg(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Pending withdrawal queue</h2>
        <button onClick={load} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {msg && <div className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl p-3">{msg}</div>}
      {err && <div className="text-xs bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl p-3">{err}</div>}
      {!items && !err && <div className="text-slate-400 text-sm">Loading…</div>}
      {items && items.length === 0 && <div className="text-slate-400 text-sm text-center py-10">No pending withdrawals. 🎉</div>}

      {items?.map((w) => (
        <div key={w.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm">{w.username ? `@${w.username}` : `tg ${w.telegram_id}`}</span>
                {w.shadow_banned && (
                  <span className="text-[10px] font-bold bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full">⚠ shadow-banned</span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">#{w.id} · {timeAgo(w.created_at)} · tg_id {w.telegram_id}</div>
            </div>
            <div className="text-lg font-black text-emerald-400 whitespace-nowrap">{formatCoins(w.amount)} 🪙</div>
          </div>

          <div className="text-xs space-y-1">
            <div><span className="text-slate-500">Method:</span> <span className="text-slate-200">{w.method}</span></div>
            <div><span className="text-slate-500">Destination:</span> <span className="font-mono text-slate-200 break-all">{w.destination}</span></div>
          </div>

          {rejectId === w.id ? (
            <div className="space-y-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (shown to user)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
              />
              <div className="flex gap-2">
                <button disabled={busy === w.id} onClick={() => review(w.id, "reject", reason.trim() || "rejected")}
                  className="px-3 py-2 bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50">
                  Confirm reject
                </button>
                <button onClick={() => setRejectId(null)} className="px-3 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button disabled={busy === w.id} onClick={() => review(w.id, "approve")}
                className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50">
                Approve
              </button>
              <button disabled={busy === w.id} onClick={() => { setRejectId(w.id); setReason(""); }}
                className="px-3 py-2 bg-rose-500/90 hover:bg-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50">
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const UsersAdmin: React.FC = () => {
  const [tgId, setTgId] = useState("");
  const [user, setUser] = useState<AdminUser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const id = tgId.trim();
    if (!id) return;
    setBusy(true);
    setNotFound(false);
    setUser(null);
    setMsg(null);
    try {
      const r = await api.get<{ user: AdminUser }>(`/api/admin/users/${id}`);
      setUser(r.data.user);
    } catch {
      setNotFound(true);
    } finally {
      setBusy(false);
    }
  }

  async function reload() {
    if (!user) return;
    const r = await api.get<{ user: AdminUser }>(`/api/admin/users/${user.telegram_id}`);
    setUser(r.data.user);
  }

  async function adjust() {
    if (!user) return;
    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt === 0) {
      setMsg("Enter a non-zero integer amount.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`/api/admin/users/${user.telegram_id}/adjust`, { amount: amt, reason: adjReason.trim() || "manual adjustment" });
      setMsg("Balance updated.");
      setAmount("");
      setAdjReason("");
      await reload();
    } catch (e) {
      setMsg(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function setFlag(flag: "banned" | "shadow_banned", value: boolean) {
    if (!user) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`/api/admin/users/${user.telegram_id}/flags`, { [flag]: value });
      setMsg(`${flag} ${value ? "set" : "cleared"}.`);
      await reload();
    } catch (e) {
      setMsg(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={lookup} className="flex gap-2">
        <input
          value={tgId}
          onChange={(e) => setTgId(e.target.value)}
          placeholder="Telegram user id"
          inputMode="numeric"
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400"
        />
        <button disabled={busy} className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50">
          Look up
        </button>
      </form>

      {msg && <div className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl p-3">{msg}</div>}
      {notFound && <div className="text-xs bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl p-3">No user with that telegram id.</div>}

      {user && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">{user.username ? `@${user.username}` : user.first_name ?? "user"}</span>
                {user.banned && <span className="text-[10px] font-bold bg-rose-500/15 text-rose-300 px-2 py-0.5 rounded-full">banned</span>}
                {user.shadow_banned && <span className="text-[10px] font-bold bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full">shadow-banned</span>}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">tg_id {user.telegram_id} · db id {user.id}</div>
            </div>
            <div className="text-lg font-black text-emerald-400 whitespace-nowrap">{formatCoins(user.balance)} 🪙</div>
          </div>

          <div className="text-[11px] text-slate-500">
            streak {user.streak_days} · referred_by {user.referred_by ?? "—"} · joined {new Date(user.created_at).toLocaleDateString()}
          </div>

          <div className="border-t border-slate-800 pt-4 space-y-2">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Adjust balance</div>
            <div className="grid grid-cols-2 gap-2">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="± coins"
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400" />
              <input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="reason (audit log)"
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400" />
            </div>
            <button onClick={adjust} disabled={busy} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50">
              Apply adjustment
            </button>
          </div>

          <div className="border-t border-slate-800 pt-4 space-y-2">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Moderation</div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setFlag("banned", !user.banned)} disabled={busy}
                className={`px-3 py-2 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 ${user.banned ? "bg-emerald-500 text-slate-950" : "bg-rose-500 text-white"}`}>
                {user.banned ? "Unban" : "Ban"}
              </button>
              <button onClick={() => setFlag("shadow_banned", !user.shadow_banned)} disabled={busy}
                className={`px-3 py-2 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 ${user.shadow_banned ? "bg-emerald-500 text-slate-950" : "bg-amber-500 text-slate-950"}`}>
                {user.shadow_banned ? "Remove shadow-ban" : "Shadow-ban"}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">Shadow-banned users keep earning but their withdrawals stay frozen for review.</p>
          </div>
        </div>
      )}
    </div>
  );
};
