"use client";

/**
 * HARIS v2 — Share Panel (workspace paylaşım yönetimi)
 *
 * Multi-user collaboration hafif sürüm:
 *  - Email ile davet (viewer/editor/admin rolü)
 *  - Aktif paylaşımlar listesi
 *  - Davet iptal
 */

import { useCallback, useEffect, useState } from "react";

interface Share {
  id: string;
  sharedWithEmail: string;
  role: "viewer" | "editor" | "admin";
  status: "pending" | "accepted" | "revoked";
  invitedAt: string;
}

interface Props {
  workspaceId: string;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, { label: string; desc: string }> = {
  viewer: { label: "👁 Görüntüleyici", desc: "Sadece okuyabilir" },
  editor: { label: "✏️ Editör", desc: "Düzenleyebilir, belge ekler" },
  admin: { label: "👑 Admin", desc: "Tam yetki, paylaşabilir" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Bekliyor", color: "text-amber-300" },
  accepted: { label: "Aktif", color: "text-emerald-300" },
  revoked: { label: "İptal", color: "text-slate-500" },
};

export function SharePanel({ workspaceId, onClose }: Props) {
  const [shares, setShares] = useState<Share[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor" | "admin">("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/workspaces/${workspaceId}/shares`);
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares ?? []);
      }
    } catch {
      // ignore
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/workspaces/${workspaceId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setEmail("");
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0E1B30] border border-white/15 rounded-xl max-w-2xl w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-xl font-bold text-[#C9A961]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            🤝 Paylaşım
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="text-xs text-slate-400 mb-4">
          Bu workspace'i ekip üyelerinizle paylaşın. Davet edilen kişi sizin
          hesabınızla aynı maile sahip olduğunda erişim açılır.
        </div>

        {/* Davet formu */}
        <div className="mb-6 p-4 rounded-lg border border-white/10 bg-white/[0.02]">
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">
            Yeni Davet
          </div>
          <div className="flex flex-col gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@hukukbürosu.com"
              className="w-full px-3 py-2 rounded bg-black/30 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500"
            />
            <div className="grid grid-cols-3 gap-2">
              {(["viewer", "editor", "admin"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`p-2 rounded border text-left text-xs transition ${
                    role === r
                      ? "border-[#C9A961] bg-[#C9A961]/10"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <div className="font-medium">{ROLE_LABELS[r].label}</div>
                  <div className="text-[10px] text-slate-500">
                    {ROLE_LABELS[r].desc}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={invite}
              disabled={loading || !email.trim()}
              className="px-4 py-2 rounded bg-[#C9A961] text-[#0A1628] font-semibold text-sm hover:bg-[#e6c479] disabled:opacity-50"
            >
              {loading ? "Davet gönderiliyor…" : "✉️ Davet Et"}
            </button>
            {error && (
              <div className="text-xs text-rose-300">{error}</div>
            )}
          </div>
        </div>

        {/* Aktif paylaşımlar */}
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">
            Aktif Paylaşımlar ({shares.length})
          </div>
          {shares.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-6">
              Henüz paylaşım yok
            </div>
          ) : (
            <div className="space-y-2">
              {shares.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded border border-white/10 bg-white/[0.02]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {s.sharedWithEmail}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {ROLE_LABELS[s.role].label} ·{" "}
                      <span className={STATUS_LABELS[s.status].color}>
                        {STATUS_LABELS[s.status].label}
                      </span>{" "}
                      · {new Date(s.invitedAt).toLocaleDateString("tr-TR")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
