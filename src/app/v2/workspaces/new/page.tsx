"use client";

/**
 * HARIS v2 — Yeni Workspace / Onboarding
 * Sprint 11.2: Gerçek API çağrısı + upload.
 *
 * Karar 1 (kullanıcı onaylı): EN AZ 1 BELGE ZORUNLU
 */

import { uuid } from "@/lib/v2/utils/uuid";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FlowStepper } from "@/components/flow/flow-stepper";

interface PendingFile {
  id: string;
  file: File;
  status: "queued" | "uploading" | "ready" | "error";
}

const QUICK_START_OPTIONS = [
  {
    id: "complaint",
    icon: "📋",
    label: "Şikâyet Dilekçesi",
    desc: "Yeni dava açıyorum",
    case_type: "şikayet",
  },
  {
    id: "response",
    icon: "⚖️",
    label: "Cevap Dilekçesi",
    desc: "Aleyhime dava açıldı",
    case_type: "cevap",
  },
  {
    id: "expert_obj",
    icon: "📑",
    label: "Bilirkişi İtirazı",
    desc: "Rapora itiraz edeceğim",
    case_type: "bilirkişi_itiraz",
  },
  {
    id: "appeal",
    icon: "🔍",
    label: "Temyiz / İstinaf",
    desc: "Karara karşı kanun yolu",
    case_type: "temyiz",
  },
];

export default function NewWorkspacePage() {
  const router = useRouter();
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [quickStartId, setQuickStartId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [court, setCourt] = useState("");
  const [esasNo, setEsasNo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const pending: PendingFile[] = Array.from(newFiles).map((f) => ({
      id: uuid(),
      file: f,
      status: "queued",
    }));
    setFiles((prev) => [...prev, ...pending]);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer?.files?.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const canProceed = files.length >= 1;

  const handleCreate = async () => {
    if (!canProceed) return;
    setIsCreating(true);
    setError(null);
    try {
      // 1. Workspace oluştur
      setProgress("Workspace oluşturuluyor…");
      const caseType =
        QUICK_START_OPTIONS.find((q) => q.id === quickStartId)?.case_type ?? "";
      const resCreate = await fetch("/api/v2/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || `Yeni Dava (${new Date().toLocaleDateString("tr-TR")})`,
          case_type: caseType,
          preferences: { court, esasNo },
        }),
      });
      if (!resCreate.ok) {
        throw new Error(`Workspace oluşturulamadı (${resCreate.status})`);
      }
      const { workspace } = await resCreate.json();

      // 2. Belgeleri yükle
      setProgress(`${files.length} belge yükleniyor + AI sınıflıyor…`);
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f.file));
      const resUpload = await fetch(
        `/api/v2/workspaces/${workspace.id}/documents`,
        { method: "POST", body: formData }
      );
      if (!resUpload.ok) {
        throw new Error(`Belgeler yüklenemedi (${resUpload.status})`);
      }

      setProgress("Workspace'e yönlendiriliyor…");
      router.push(`/v2/workspaces/${workspace.id}`);
    } catch (e) {
      setError(String(e));
      setIsCreating(false);
      setProgress(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link
          href="/v2"
          className="inline-block text-sm text-slate-400 hover:text-slate-200 mb-6"
        >
          ← Başlangıç
        </Link>
        <FlowStepper
          current={files.length > 0 ? "documents" : "open"}
          className="mb-8"
        />
        <h1
          className="text-3xl font-bold mb-2"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Yeni Dava Dosyası
        </h1>
        <p className="text-slate-400">
          Belgelerinizi sürükleyin. Orkestra Şefi ve uzman ajanlar inceleyip
          karşılayacak.
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-xs uppercase tracking-widest text-slate-500 mb-2">
          Dava Başlığı (opsiyonel)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Örn. Trafik Kazası Tazminat — Yılmaz vs. Aksigorta"
          className="w-full px-4 py-3 rounded-lg bg-white/[0.03] border border-white/10 focus:border-[#C9A961]/50 focus:outline-none focus:ring-1 focus:ring-[#C9A961]/30 text-slate-100 placeholder:text-slate-500"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-widest text-slate-500 mb-2">
            Mahkeme
          </label>
          <input
            value={court}
            onChange={(e) => setCourt(e.target.value)}
            placeholder="Örn. İstanbul 4. Asliye Hukuk"
            className="w-full px-4 py-3 rounded-lg bg-white/[0.03] border border-white/10 text-slate-100 placeholder:text-slate-500"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-slate-500 mb-2">
            Esas No
          </label>
          <input
            value={esasNo}
            onChange={(e) => setEsasNo(e.target.value)}
            placeholder="2025/1234"
            className="w-full px-4 py-3 rounded-lg bg-white/[0.03] border border-white/10 text-slate-100 placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-xs uppercase tracking-widest text-slate-500 mb-3">
          Hızlı Başlangıç (opsiyonel)
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_START_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() =>
                setQuickStartId(quickStartId === opt.id ? null : opt.id)
              }
              className={`p-3 rounded-lg border text-left transition ${
                quickStartId === opt.id
                  ? "border-[#C9A961] bg-[#C9A961]/10"
                  : "border-white/10 hover:border-white/30 bg-white/[0.02]"
              }`}
            >
              <div className="text-xl mb-1">{opt.icon}</div>
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mb-4 rounded-2xl border-2 border-dashed p-12 text-center transition ${
          dragOver
            ? "border-[#C9A961] bg-[#C9A961]/10"
            : "border-white/15 hover:border-white/30 bg-white/[0.02]"
        }`}
      >
        <div className="text-5xl mb-3">📁</div>
        <div className="text-lg font-semibold mb-2">
          Dosyalarınızı buraya sürükleyin
        </div>
        <div className="text-sm text-slate-400 mb-4">
          PDF · Word · UDF (UYAP) · Görsel (JPG/PNG) · TXT — birden fazla seçebilirsiniz
        </div>
        <label className="inline-block">
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt,.md,.udf,image/*"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <span className="px-5 py-2 rounded-lg bg-[#C9A961] text-[#0A1628] font-semibold cursor-pointer hover:bg-[#e6c479] transition">
            Dosya Seç
          </span>
        </label>
      </div>

      {files.length > 0 && (
        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">
            {files.length} Belge Yüklenecek
          </div>
          <div className="space-y-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10"
              >
                <span className="text-lg">📄</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{f.file.name}</div>
                  <div className="text-xs text-slate-500">
                    {(f.file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button
                  onClick={() => removeFile(f.id)}
                  className="text-slate-500 hover:text-rose-400 px-2"
                  disabled={isCreating}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!canProceed && !isCreating && (
        <div className="mb-6 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 text-sm text-amber-200/80">
          <strong>En az 1 belge yüklemelisiniz.</strong> HARIS, belgeleri
          analiz ederek davayı anlar ve uygun ajanları görevlendirir.
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 rounded-lg border border-rose-500/30 bg-rose-500/10 text-sm text-rose-200">
          <strong>Hata:</strong> {error}
        </div>
      )}

      {progress && (
        <div className="mb-4 p-4 rounded-lg border border-[#C9A961]/30 bg-[#C9A961]/10 text-sm text-[#C9A961]">
          <span className="inline-block animate-spin mr-2">⟳</span>
          {progress}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {canProceed
            ? `${files.length} belge hazır → Orkestra Şefi karşılayacak`
            : "Devam etmek için belge ekleyin"}
        </div>
        <button
          onClick={handleCreate}
          disabled={!canProceed || isCreating}
          className={`px-6 py-3 rounded-lg font-semibold transition ${
            canProceed && !isCreating
              ? "bg-[#C9A961] text-[#0A1628] hover:bg-[#e6c479]"
              : "bg-white/5 text-slate-500 cursor-not-allowed"
          }`}
        >
          {isCreating ? "İşleniyor…" : "Workspace Oluştur →"}
        </button>
      </div>
    </div>
  );
}
