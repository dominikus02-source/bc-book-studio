"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { StudioRole } from "@prisma/client";
import { ASSIGNABLE_ROLES, accountDeactivateError, accountMutationError } from "@/lib/account-admin";

type Account = { id: string; email: string; name: string; role: StudioRole; active: boolean; createdAt: string };
type Me = { id: string; role: StudioRole };

const roleLabel: Record<StudioRole, string> = {
  EDITOR: "Editor",
  REVIEWER: "Peninjau",
  ADMIN: "Admin",
  SUPERADMIN: "Superadmin",
};

export function AccountManagement() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StudioRole>("EDITOR");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const activeSuperadminCount = useMemo(
    () => accounts.filter((account) => account.role === "SUPERADMIN" && account.active).length,
    [accounts]
  );

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const data = await response.json() as { users?: Account[]; me?: Me; error?: string };
    if (!response.ok) throw new Error(data.error || "Gagal memuat akun");
    setAccounts(data.users || []);
    setMe(data.me || null);
  }, []);

  useEffect(() => { void load().catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Gagal memuat akun")); }, [load]);

  function lockReason(target: Account, changes: { role?: StudioRole; active?: boolean }) {
    if (!me) return "Memuat sesi…";
    return accountMutationError(me, target, changes, activeSuperadminCount);
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, role }) });
      const data = await response.json() as { warning?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Gagal mengundang akun");
      setName("");
      setEmail("");
      setRole("EDITOR");
      setStatus(data.warning || "Undangan aktivasi telah dikirim.");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal mengundang akun");
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, body: { name?: string; role?: StudioRole; active?: boolean }) {
    setPending((current) => ({ ...current, [id]: true }));
    setStatus("");
    try {
      const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Gagal memperbarui akun");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal memperbarui akun");
      await load().catch(() => undefined);
    } finally {
      setPending((current) => ({ ...current, [id]: false }));
    }
  }

  async function resend(id: string) {
    setPending((current) => ({ ...current, [id]: true }));
    setStatus("");
    try {
      const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, resendActivation: true }) });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Gagal mengirim ulang aktivasi");
      setStatus(data.message || "Undangan aktivasi telah dikirim ulang.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal mengirim ulang aktivasi");
    } finally {
      setPending((current) => ({ ...current, [id]: false }));
    }
  }

  async function deactivate(id: string) {
    const target = accounts.find((account) => account.id === id);
    if (!target) return;
    const denied = me ? accountDeactivateError(me, target, activeSuperadminCount) : "Memuat sesi…";
    if (denied) { setStatus(denied); return; }
    if (!window.confirm(`Nonaktifkan akun ${target.name} (${target.email})? Data tetap disimpan.`)) return;
    setPending((current) => ({ ...current, [id]: true }));
    setStatus("");
    try {
      const response = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Gagal menonaktifkan akun");
      setStatus(data.message || "Akun dinonaktifkan.");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal menonaktifkan akun");
    } finally {
      setPending((current) => ({ ...current, [id]: false }));
    }
  }

  async function resetPassword(id: string) {
    setPending((current) => ({ ...current, [id]: true }));
    setStatus("");
    try {
      const response = await fetch("/api/admin/users/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: id }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Gagal mereset kata sandi");
      setStatus("Tautan reset kata sandi telah dikirim.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal mereset kata sandi");
    } finally {
      setPending((current) => ({ ...current, [id]: false }));
    }
  }

  return (
    <section className="studio-panel studio-stack">
      <div>
        <p className="studio-kicker">Manajemen akun</p>
        <h2>Undang dan kelola anggota studio</h2>
        <p className="studio-copy">Superadmin dapat mengundang, mengubah nama/peran/status, mengirim ulang aktivasi, dan menonaktifkan anggota. Hanya superadmin yang boleh memberi atau mencabut peran Superadmin. Superadmin aktif terakhir dan akun Anda sendiri tidak dapat dinonaktifkan atau diturunkan hingga ada superadmin aktif lain.</p>
      </div>
      <form className="studio-stack" onSubmit={invite}>
        <label className="studio-field"><span>Nama</span><input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} /></label>
        <label className="studio-field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label className="studio-field"><span>Peran</span>
          <select value={role} onChange={(event) => setRole(event.target.value as StudioRole)}>
            {ASSIGNABLE_ROLES.map((value) => <option key={value} value={value}>{roleLabel[value]}</option>)}
          </select>
        </label>
        <button className="studio-button" disabled={busy}>{busy ? "Mengirim…" : "Kirim undangan"}</button>
      </form>
      {status ? <p className="studio-status" role="status">{status}</p> : null}
      <div className="studio-account-list">
        {accounts.map((account) => {
          const working = !!pending[account.id];
          const deactivateDenied = lockReason(account, { active: false });
          const roleLocked = !!lockReason(account, { role: account.role === "SUPERADMIN" ? "ADMIN" : account.role });
          return (
            <article key={account.id} className="studio-account-card">
              <div>
                <strong>{account.name}</strong>
                <p>{account.email}</p>
                {me?.id === account.id ? <p className="studio-copy">Ini akun Anda</p> : null}
              </div>
              <label className="studio-field"><span>Nama tampilan</span>
                <input defaultValue={account.name} disabled={working} onBlur={(event) => {
                  const next = event.target.value.trim();
                  if (next && next !== account.name) void update(account.id, { name: next });
                }} />
              </label>
              <label className="studio-field"><span>Peran</span>
                <select value={account.role} disabled={working || roleLocked} onChange={(event) => void update(account.id, { role: event.target.value as StudioRole })}>
                  {ASSIGNABLE_ROLES.map((value) => <option key={value} value={value}>{roleLabel[value]}</option>)}
                </select>
              </label>
              <label className="studio-field"><span>Status</span>
                <select value={account.active ? "active" : "inactive"} disabled={working || (account.active && !!deactivateDenied)} onChange={(event) => void update(account.id, { active: event.target.value === "active" })}>
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </label>
              <div className="studio-row-actions">
                {!account.active ? <button type="button" className="studio-button studio-button-secondary" disabled={working} onClick={() => void resend(account.id)}>Kirim ulang aktivasi</button> : null}
                {account.active ? <button type="button" className="studio-button studio-button-secondary" disabled={working} onClick={() => void resetPassword(account.id)}>Reset kata sandi</button> : null}
                {account.active ? <button type="button" className="studio-button studio-button-secondary" disabled={working || !!deactivateDenied} onClick={() => void deactivate(account.id)}>Nonaktifkan</button> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default AccountManagement;
