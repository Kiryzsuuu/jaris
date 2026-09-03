"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";

type Role = { id: string; name: string; slug: string; permissions: string[] };
type UserRow = {
  id: string;
  name: string;
  email: string;
  branch: string;
  isActive: boolean;
  role: { id: string; name: string; slug: string } | null;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: "", branch: "Kantor Pusat" });
  const [creating, setCreating] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch("/api/users").then((r) => r.json()),
        fetch("/api/roles").then((r) => r.json()),
      ]);

      if (!usersRes.success) {
        setError(usersRes.message ?? "Gagal memuat pengguna");
      } else {
        setUsers(usersRes.data);
      }

      if (rolesRes.success) {
        setRoles(rolesRes.data);
        setForm((f) => ({ ...f, roleId: f.roleId || rolesRes.data[0]?.id || "" }));
      }
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadData();
  }, [loadData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormMessage(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) {
        setFormMessage(json.message ?? "Gagal membuat pengguna");
        return;
      }
      setForm((f) => ({ ...f, name: "", email: "", password: "" }));
      setFormMessage("Pengguna berhasil dibuat");
      loadData();
    } catch {
      setFormMessage("Tidak dapat menghubungi server");
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(userId: string, roleId: string) {
    await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId }),
    });
    loadData();
  }

  async function handleToggleActive(userId: string, isActive: boolean) {
    await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    loadData();
  }

  return (
    <AppShell pageTitle="Manajemen Pengguna" pageSubtitle="Akun, peran, dan wilayah penempatan pegawai">
      <div className="card mb-6">
        <div className="card-body">
          <h2 className="mb-3 text-base font-semibold text-[#1d2630]">Tambah Pengguna</h2>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3" autoComplete="off">
            <div>
              <label className="form-label">Nama</label>
              <input
                required
                className="form-control"
                autoComplete="off"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Email Pengguna Baru</label>
              <input
                type="email"
                required
                className="form-control"
                autoComplete="off"
                name="new-user-email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Password Awal</label>
              <input
                type="password"
                required
                minLength={8}
                className="form-control"
                autoComplete="new-password"
                name="new-user-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Wilayah/Cabang</label>
              <input required placeholder="mis. Cabang Jakarta" className="form-control" value={form.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Peran</label>
              <select required className="form-select" value={form.roleId} onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={creating} className="btn btn-primary">
              {creating ? "Menyimpan..." : "Tambah"}
            </button>
          </form>
          {formMessage && <p className="text-secondary-400 mt-2 mb-0 text-sm">{formMessage}</p>}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {loading && <p>Memuat...</p>}
          {error && <p className="text-danger-600">{error}</p>}

          {!loading && !error && (
            <div className="table-responsive">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Email</th>
                    <th>Cabang</th>
                    <th>Peran</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.branch}</td>
                      <td>
                        <select
                          className="form-select w-auto"
                          value={u.role?.id ?? ""}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`badge ${u.isActive ? "bg-success-100 text-success-700" : "bg-danger-100 text-danger-700"}`}>
                          {u.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleActive(u.id, u.isActive)}
                          className="btn btn-outline-primary btn-sm"
                        >
                          {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
