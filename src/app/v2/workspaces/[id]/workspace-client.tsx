"use client";

import { uuid } from "@/lib/v2/utils/uuid";
import { useState, useCallback, useRef } from "react";
import { ThreePanelLayout } from "@/components/v2/layout/three-panel-layout";
import { VaultPanel } from "@/components/v2/vault/vault-panel";
import { WorkflowViewer } from "@/components/v2/workflow/workflow-viewer";
import { OrchestratorChat } from "@/components/v2/chat/orchestrator-chat";
import { PetitionCanvas } from "@/components/v2/canvas/petition-canvas";
import { WorkspaceNextStep } from "@/components/flow/workspace-next-step";
import { CheckpointDialog } from "@/components/v2/workflow/checkpoint-dialog";
import { QualityGateView } from "@/components/v2/canvas/quality-gate-view";
import { WorkspaceSettingsPanel } from "@/components/v2/settings/workspace-settings-panel";
import { MethodPicker, type ExtractionMethod } from "@/components/v2/vault/method-picker";
import { TabularReviewView } from "@/components/v2/tabular/tabular-review-view";
import { SharePanel } from "@/components/v2/sharing/share-panel";
import { OrchestraRail } from "@/components/v2/layout/orchestra-rail";
import type {
  VaultDocument,
  AgentOutput,
  UserCheckpoint,
  AgentMessage,
  RoundNumber,
} from "@/lib/v2/state/workspace-state";
import { AGENTS, type AgentId } from "@/lib/v2/orchestra/agents";
import type { WorkspaceRow } from "@/lib/v2/workspace/db";

interface ChatMessage {
  id: string;
  role: "user" | "orchestrator" | "agent";
  agentId?: AgentId;
  content: string;
  timestamp: string;
  rawResponse?: unknown;
  citations?: import("@/components/v2/chat/citations-view").Citations;
}

interface Props {
  workspaceId: string;
  initialWorkspace: WorkspaceRow;
  initialDocuments: VaultDocument[];
  initialAgentOutputs: AgentOutput[];
  initialAgentMessages: AgentMessage[];
  initialPetition: { version: number; markdown: string; quality?: unknown } | null;
}

export function WorkspaceClient({
  workspaceId,
  initialWorkspace,
  initialDocuments,
  initialAgentOutputs,
  initialAgentMessages,
  initialPetition,
}: Props) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [documents, setDocuments] = useState<VaultDocument[]>(initialDocuments);
  const [agentOutputs, setAgentOutputs] =
    useState<AgentOutput[]>(initialAgentOutputs);
  const [agentMessages, setAgentMessages] =
    useState<AgentMessage[]>(initialAgentMessages);
  const [petition, setPetition] = useState(initialPetition);
  const [checkpoints, setCheckpoints] = useState<UserCheckpoint[]>([]);
  const [openCheckpointId, setOpenCheckpointId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [showTabular, setShowTabular] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [orchestraStatus, setOrchestraStatus] = useState<string>(
    workspace.orchestration_status
  );
  const [analysisStage, setAnalysisStage] = useState<string>("");
  const [qualityIterations, setQualityIterations] = useState<Array<{ iteration: number; score: number; status: string }>>([]);
  const [deliveryGate, setDeliveryGate] = useState<{ status: string; reason: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Initial chat: orkestra şefi karşılaması ──────────────
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialAgentMessages.length > 0) {
      return initialAgentMessages
        .filter((m) => m.type === "user_chat" || m.type === "agent_chat" || m.type === "synthesis")
        .map((m) => ({
          id: m.id,
          role: m.from === "user" ? "user" : m.from === "orchestrator" ? "orchestrator" : "agent",
          agentId:
            m.from !== "user" && m.from !== "orchestrator"
              ? (m.from as AgentId)
              : undefined,
          content: m.content,
          timestamp: new Date(m.timestamp).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
    }
    // Hiç mesaj yoksa şefin karşılaması
    const docCount = initialDocuments.length;
    const categories = Array.from(
      new Set(initialDocuments.map((d) => d.category).filter(Boolean))
    );
    const intro =
      docCount === 0
        ? "Merhaba. Henüz belge eklenmemiş. Sol Vault panelinden belge yüklediğinizde davayı inceleyip karşılayabilirim."
        : `Merhaba. ${docCount} belge inceledim${
            categories.length > 0
              ? ` (${categories.slice(0, 3).join(", ")}${
                  categories.length > 3 ? "…" : ""
                })`
              : ""
          }.\n\n` +
          (workspace.case_type
            ? `Bu bir **${workspace.case_type}** dosyası gibi görünüyor. `
            : "") +
          `Aşağıdaki "Süreci Başlat" butonuna basarsanız 12 uzman ajandan uygun olanları görevlendirip 3 turlu inceleme başlatıyorum.\n\nNasıl yardımcı olabilirim?`;
    return [
      {
        id: uuid(),
        role: "orchestrator",
        content: intro,
        timestamp: new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ];
  });

  // ── Vault: yeni dosya ekleme ──────────────────────────────
  const handleAddFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDeleteDocument = useCallback(async (docId: string) => {
    // Optimistic: UI'dan hemen kaldır
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    try {
      await fetch(
        `/api/v2/workspaces/${workspaceId}/documents?docId=${docId}`,
        { method: "DELETE" }
      );
    } catch (e) {
      console.error("Silme hatası:", e);
      // Hata olursa geri yükle
      const res = await fetch(`/api/v2/workspaces/${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents ?? []);
      }
    }
  }, [workspaceId]);

  const handleRetryDocument = useCallback(async (docId: string) => {
    try {
      const res = await fetch(
        `/api/v2/workspaces/${workspaceId}/documents?docId=${docId}`,
        { method: "PATCH" }
      );
      if (res.ok) {
        const data = await res.json();
        alert(data.message || "Belgeyi silip tekrar yükleyin.");
      }
    } catch (e) {
      console.error("Retry hatası:", e);
    }
  }, [workspaceId]);

  const handleClearHistory = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v2/workspaces/${workspaceId}/chat/clear`,
        { method: "POST" }
      );
      if (res.ok) {
        // Sadece karşılama mesajını bırak
        setMessages((prev) => prev.slice(0, 1));
        setAgentMessages([]);
      }
    } catch (e) {
      console.error("Chat temizleme hatası:", e);
    }
  }, [workspaceId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    // Picker'ı aç — kullanıcı yöntem seçsin
    setPendingFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadFilesWithMethod = async (
    files: File[],
    method: ExtractionMethod
  ) => {
    setPendingFiles(null);
    // Optimistic UI
    const placeholders: VaultDocument[] = files.map((f) => ({
      id: uuid(),
      filename: f.name,
      mimeType: f.type || "application/octet-stream",
      sizeBytes: f.size,
      uploadedAt: new Date().toISOString(),
      status: "uploading",
    }));
    setDocuments((prev) => [...prev, ...placeholders]);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    formData.append("extractionMethod", method);

    try {
      const res = await fetch(
        `/api/v2/workspaces/${workspaceId}/documents`,
        { method: "POST", body: formData }
      );
      if (!res.ok) throw new Error(`Upload başarısız (${res.status})`);
      const wsRes = await fetch(`/api/v2/workspaces/${workspaceId}`);
      if (wsRes.ok) {
        const data = await wsRes.json();
        setDocuments(data.documents ?? []);
      }
    } catch (err) {
      setDocuments((prev) =>
        prev.map((d) =>
          placeholders.find((p) => p.id === d.id)
            ? { ...d, status: "error", summary: String(err) }
            : d
        )
      );
    }
  };

  // ── Süreci başlat (Sprint 11.3) ──────────────────────────
  const startOrchestration = async () => {
    if (documents.length === 0) {
      alert("Önce belge yükleyin.");
      return;
    }
    setIsOrchestrating(true);
    setOrchestraStatus("running");

    // SSE stream başlat
    try {
      const res = await fetch(
        `/api/v2/workspaces/${workspaceId}/orchestrate`,
        { method: "POST" }
      );
      if (!res.ok || !res.body) {
        throw new Error(`Orkestra başlatılamadı (${res.status})`);
      }
      await consumeSSE(res.body);
      await refreshPetitionFromServer();
    } catch (err) {
      console.error(err);
      setOrchestraStatus("error");
    } finally {
      setIsOrchestrating(false);
    }
  };

  const consumeSSE = async (stream: ReadableStream<Uint8Array>) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("[SSE] stream tamamlandı", new Date().toISOString());
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const evt of events) {
        if (!evt.trim()) continue;
        const dataLine = evt
          .split("\n")
          .find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        try {
          const payload = JSON.parse(dataLine.slice(6));
          handleSSEEvent(payload);
        } catch (e) {
          console.warn("SSE parse hatası:", e);
        }
      }
    }
  };

  const handleSSEEvent = (event: {
    type: string;
    [k: string]: unknown;
  }) => {
  switch (event.type) {
  case "analysis_stage":
    setAnalysisStage(String(event.message ?? event.stage ?? ""));
    break;
  case "quality_iteration":
    setQualityIterations((prev) => [...prev.filter((item) => item.iteration !== Number(event.iteration)), { iteration: Number(event.iteration), score: Number(event.score ?? 0), status: String(event.status ?? "") }]);
    break;
  case "delivery_gate": {
    const gate = event.gate as { status: string; reason: string };
    setDeliveryGate(gate);
    break;
  }
  case "round_start":
        setWorkspace((w) => ({
          ...w,
          current_round: event.round as RoundNumber,
        }));
        break;
      case "agent_start":
        setAgentOutputs((prev) => [
          ...prev.filter(
            (o) =>
              !(o.agentId === event.agentId && o.round === event.round)
          ),
          {
            agentId: event.agentId as AgentId,
            round: event.round as RoundNumber,
            startedAt: new Date().toISOString(),
            status: "running",
          },
        ]);
        break;
      case "agent_done":
        if (
          event.agentId === "dilekce_editoru" &&
          typeof event.content === "string" &&
          event.content.length > 80
        ) {
          console.log(
            `[CANVAS] dilekce_editoru agent_done · ${event.content.length} chars`
          );
          setPetition((p) => ({
            version: p?.version ?? 1,
            markdown: event.content as string,
            quality: p?.quality,
          }));
        }
        setAgentOutputs((prev) =>
          prev.map((o) =>
            o.agentId === event.agentId && o.round === event.round
              ? {
                  ...o,
                  status: "done",
                  finishedAt: new Date().toISOString(),
                  content: event.content as string,
                  tokensUsed: event.tokensUsed as {
                    input: number;
                    output: number;
                  },
                  cost: event.cost as number,
                  rawResponse: event.rawResponse,
                }
              : o
          )
        );
        break;
      case "agent_message":
        setAgentMessages((prev) => [
          ...prev,
          {
            id: uuid(),
            from: event.from as AgentMessage["from"],
            to: event.to as AgentMessage["to"],
            round: event.round as RoundNumber,
            timestamp: new Date().toISOString(),
            content: event.content as string,
            type: event.messageType as AgentMessage["type"],
          },
        ]);
        break;
      case "checkpoint":
        setCheckpoints((prev) => [...prev, event.checkpoint as UserCheckpoint]);
        setOpenCheckpointId((event.checkpoint as UserCheckpoint).id);
        setOrchestraStatus("paused_for_user");
        break;
      case "petition_draft": {
        const md = event.markdown as string;
        console.log(
          `[SSE petition_draft] v${event.version} · ${md?.length ?? 0} chars`
        );
        console.log(
          `[CANVAS] petition_draft v${event.version} alındı`
        );
        setPetition({
          version: event.version as number,
          markdown: md,
          quality: event.quality,
        });
        break;
      }
      case "orchestrator_message":
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("haris:memory-refresh"));
        }
        setMessages((prev) => [
          ...prev,
          {
            id: uuid(),
            role: "orchestrator",
            content: event.content as string,
            timestamp: new Date().toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
        break;
      case "completed":
        setOrchestraStatus("completed");
        setWorkspace((w) => ({ ...w, current_round: 3 }));
        break;
      case "error":
        setOrchestraStatus("error");
        alert(`Orkestra hatası: ${event.message}`);
        break;
    }
  };

  // ── Checkpoint çözümleme ────────────────────────────────
  const handleCheckpointResolve = async (
    checkpointId: string,
    choice: string
  ) => {
    setCheckpoints((prev) =>
      prev.map((c) =>
        c.id === checkpointId
          ? { ...c, userChoice: choice, resolvedAt: new Date().toISOString() }
          : c
      )
    );
    setOpenCheckpointId(null);
    setOrchestraStatus("running");
    setIsOrchestrating(true);
    try {
      const res = await fetch(
        `/api/v2/workspaces/${workspaceId}/orchestrate/resume`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkpointId, choice }),
        }
      );
      if (res.body) await consumeSSE(res.body);
      await refreshPetitionFromServer();
    } finally {
      setIsOrchestrating(false);
    }
  };

  const refreshPetitionFromServer = async () => {
    try {
      const res = await fetch(`/api/v2/workspaces/${workspaceId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.petition?.markdown) {
        console.log(
          `[CANVAS] sunucudan dilekçe yüklendi v${data.petition.version} · ${data.petition.markdown.length} chars`
        );
        setPetition(data.petition);
      }
    } catch (e) {
      console.warn("[CANVAS] yenileme hatası", e);
    }
  };

  // ── Chat gönderme ────────────────────────────────���───────
  const handleSend = async (
    content: string,
    mentionedAgents: AgentId[]
  ) => {
    // FAZ 13.5.6: Doğal dil komut tespiti — kullanıcı chat'te "başlat" yazınca orkestra
    const trimmedLower = content.trim().toLowerCase();
    const startCommands = [
      "başla", "başlat", "başlayalım", "başlayabilir",
      "süreci başlat", "orkestra başla", "orkestrayı başlat",
      "start", "başlıyoruz", "hadi başla", "haydi başla",
      "3 tur başlat", "üç tur başlat", "analiz başla",
      "işlemi başlat", "süreci başlayalım", "orkestra", "devam et",
      "incelemeyi başlat", "dilekçe yaz", "dilekçeyi yaz",
    ];
    const isStartCommand = startCommands.some((cmd) =>
      trimmedLower === cmd || trimmedLower.startsWith(cmd + " ") || trimmedLower.startsWith(cmd + "!")
    );
    if (
      isStartCommand &&
      !isOrchestrating &&
      orchestraStatus !== "running" &&
      documents.length > 0
    ) {
      // Kullanıcı mesajı ekle
      const userMsgStart: ChatMessage = {
        id: uuid(),
        role: "user",
        content,
        timestamp: new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      const ackMsg: ChatMessage = {
        id: uuid(),
        role: "orchestrator",
        content: "🎼 Anladım, süreci başlatıyorum. 12 uzman ajanın 3 turlu incelemesi başlıyor. Bu 2-4 dakika sürecek, sağdaki workflow viewer'dan takip edebilirsiniz.",
        timestamp: new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, userMsgStart, ackMsg]);
      // Orkestrayı başlat
      void startOrchestration();
      return;
    }

    setIsSending(true);
    const userMsg: ChatMessage = {
      id: uuid(),
      role: "user",
      content,
      timestamp: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch(
        `/api/v2/workspaces/${workspaceId}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, mentionedAgents }),
        }
      );
      if (!res.ok) throw new Error(`Chat hata (${res.status})`);
      const data = await res.json();
      const targetAgent = (mentionedAgents[0] ?? null) as AgentId | null;
      // Memory panel refresh trigger (AI yeni bilgi eklemiş olabilir)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("haris:memory-refresh"));
      }
      setMessages((prev) => [
        ...prev,
        {
          id: uuid(),
          role: targetAgent ? "agent" : "orchestrator",
          agentId: targetAgent ?? undefined,
          content: data.reply ?? "[Yanıt boş]",
          timestamp: new Date().toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          rawResponse: data.rawResponse,
          citations: data.citations,
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: uuid(),
          role: "orchestrator",
          content: `Hata: ${String(e)}`,
          timestamp: new Date().toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleAgentClick = (agentId: AgentId) => {
    const agent = AGENTS[agentId];
    const output = agentOutputs.find(
      (o) => o.agentId === agentId && o.round === workspace.current_round
    );
    if (!output) {
      alert(`${agent.emoji} ${agent.displayName}\nHenüz çalışmadı.`);
      return;
    }
    const ham = output.rawResponse
      ? `\n\n🔍 HAM YANIT:\n${JSON.stringify(output.rawResponse, null, 2).slice(0, 600)}`
      : "";
    alert(
      `${agent.emoji} ${agent.displayName}\nModel: ${agent.modelRole}\nDurum: ${output.status}\nToken: ${
        output.tokensUsed?.input ?? 0
      } in / ${output.tokensUsed?.output ?? 0} out\nMaliyet: $${
        output.cost?.toFixed(4) ?? "0"
      }\n\nÇIKTI:\n${(output.content ?? "[boş]").slice(0, 800)}${ham}`
    );
  };

  // ── İç diyalog dock içeriği ──────────────────────────────
  const internalDialogsContent =
    agentMessages.length === 0 ? (
      <div className="text-[11px] text-slate-500 py-2 text-center">
        Henüz iç diyalog yok. Orkestra başladığında ajan-ajan konuşmalar
        burada görünür.
      </div>
    ) : (
      <div className="space-y-2 text-[11px]">
        {agentMessages.slice(-12).map((m) => {
          const fromAgent =
            m.from !== "user" && m.from !== "orchestrator"
              ? AGENTS[m.from as AgentId]
              : null;
          const toAgent =
            m.to !== "broadcast" && AGENTS[m.to as AgentId];
          return (
            <div key={m.id} className="text-slate-400">
              <span className="text-[#C9A961]">
                {m.from === "orchestrator" ? "🎼" : fromAgent?.emoji ?? "👤"}{" "}
                {m.from === "orchestrator" ? "Şef" : fromAgent?.shortName ?? "Siz"}{" "}
                → {toAgent ? `${toAgent.emoji} ${toAgent.shortName}` : "Hepsi"}:
              </span>
              <div className="mt-0.5 pl-3 text-slate-500 line-clamp-3">
                {m.content}
              </div>
            </div>
          );
        })}
      </div>
    );

  const currentRound = (workspace.current_round || 0) as 0 | 1 | 2 | 3;

  // Kalite raporu var mı kontrol et
  const qualityReport = petition?.quality as
    | {
        paragraphs?: Array<{
          index: number;
          category: "gerekli" | "nüans" | "doldurma";
          score: number;
          reason: string;
        }>;
        summary?: { gerekli: number; nuans: number; doldurma: number; kalite_skoru: number };
      }
    | undefined;

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.txt,.md,.udf,image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top action bar */}
      <div className="px-6 py-2 border-b border-white/5 bg-[#0A1628] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold truncate max-w-md">
            {workspace.title}
          </h2>
          <span className="text-[11px] text-slate-500 truncate max-w-xs">
            {workspace.preferences?.court || "Mahkeme seçilmedi"}
            {workspace.preferences?.esasNo
              ? ` · ${workspace.preferences.esasNo}`
              : ""}
          </span>
          {analysisStage && orchestraStatus === "running" ? (
            <span className="max-w-sm truncate text-[10px] text-slate-400" title={analysisStage}>
              {analysisStage}
            </span>
          ) : null}
          {qualityIterations.length > 0 ? (
            <span className="text-[10px] text-[#C9A961]">
              Kalite {qualityIterations[qualityIterations.length - 1].iteration}/3 · {qualityIterations[qualityIterations.length - 1].score}/100
            </span>
          ) : null}
          {deliveryGate ? (
            <span className={`text-[10px] uppercase tracking-widest ${deliveryGate.status === "approved" ? "text-emerald-300" : "text-amber-300"}`} title={deliveryGate.reason}>
              {deliveryGate.status === "approved" ? "Teslime hazır" : "Avukat incelemesi"}
            </span>
          ) : null}
          {orchestraStatus === "running" ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Çalışıyor
              <span className="ml-1 inline-block w-3 h-3 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
            </span>
          ) : orchestraStatus === "paused_for_user" ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
              🟡 Kullanıcı bekleniyor
            </span>
          ) : orchestraStatus === "completed" ? (
            <span className="text-[10px] uppercase tracking-widest text-emerald-300">
              ✓ Tamamlandı
            </span>
          ) : orchestraStatus === "error" ? (
            <span className="text-[10px] uppercase tracking-widest text-rose-300">
              ⚠ Hata
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-widest text-slate-500">
              ⏸ Hazır
            </span>
          )}
        </div>
        <WorkspaceNextStep
          workspaceId={workspaceId}
          orchestrationStatus={orchestraStatus}
          documentsCount={documents.length}
          hasPetition={Boolean(petition?.markdown)}
          onAddDocuments={() => fileInputRef.current?.click()}
          onStart={startOrchestration}
          onOpenCheckpoint={() => {
            const pending = checkpoints.find((c) => !c.resolvedAt);
            if (pending) setOpenCheckpointId(pending.id);
          }}
        />
      </div>

      <ThreePanelLayout
        vault={
          <VaultPanel
            documents={documents}
            onAddFiles={handleAddFiles}
            onDeleteDocument={handleDeleteDocument}
            onRetryDocument={handleRetryDocument}
          />
        }
        workflowViewer={
          <WorkflowViewer
            currentRound={currentRound}
            agentOutputs={agentOutputs}
            checkpoints={checkpoints}
            onAgentClick={handleAgentClick}
            onCheckpointClick={(id) => setOpenCheckpointId(id)}
          />
        }
        canvas={
          qualityReport && qualityReport.paragraphs ? (
            <QualityGateView
              markdown={petition?.markdown ?? ""}
              report={qualityReport as { paragraphs: NonNullable<typeof qualityReport.paragraphs>; summary: NonNullable<typeof qualityReport.summary> }}
            />
          ) : (
            <PetitionCanvas
              workspaceId={workspaceId}
              markdown={petition?.markdown}
              version={petition?.version}
              isGenerating={
                isOrchestrating && currentRound === 3 && !petition
              }
              emptyHint={
                documents.length === 0
                  ? "Sol panelden belge ekleyin, sonra Matter panelinin solundaki dikey 'İşlemi Başlat' çubuğuna basın."
                  : "Orkestra Şefi süreç başlatıldığında dilekçe taslağı burada belirecek."
              }
            />
          )
        }
        chat={<OrchestratorChat messages={messages} onSend={handleSend} onClearHistory={handleClearHistory} workspaceId={workspaceId} isSending={isSending} />}
        internalDialogs={internalDialogsContent}
        matterRail={
          <OrchestraRail
            workspaceId={workspaceId}
            orchestraStatus={orchestraStatus}
            isOrchestrating={isOrchestrating}
            documentsCount={documents.length}
            onStart={startOrchestration}
            onTabular={() => setShowTabular(true)}
            onShare={() => setShowShare(true)}
            onSettings={() => setShowSettings(true)}
          />
        }
      />

      {/* Settings modal */}
      {showSettings && (
        <WorkspaceSettingsPanel
          initialPreferences={{
            petitionLength: workspace.preferences?.petitionLength ?? "standard",
            qualityMode: workspace.preferences?.qualityMode ?? "strict",
            checkpointMode: workspace.preferences?.checkpointMode ?? "ask_on_conflict",
            showInternalDialogs: workspace.preferences?.showInternalDialogs ?? false,
            showRawResponses: workspace.preferences?.showRawResponses ?? false,
            enabledAgents: workspace.preferences?.enabledAgents ?? [],
            court: workspace.preferences?.court ?? "",
            esasNo: workspace.preferences?.esasNo ?? "",
          }}
          onSave={async (newPrefs) => {
            await fetch(`/api/v2/workspaces/${workspaceId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ preferences: newPrefs }),
            });
            setWorkspace((w) => ({ ...w, preferences: newPrefs }));
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* OCR Method Picker */}
      {pendingFiles && pendingFiles.length > 0 && (
        <MethodPicker
          files={pendingFiles}
          defaultMethod={
            (typeof window !== "undefined" &&
              (localStorage.getItem("haris_default_ocr_method") as ExtractionMethod)) ||
            "auto"
          }
          onConfirm={(method) => uploadFilesWithMethod(pendingFiles, method)}
          onCancel={() => setPendingFiles(null)}
        />
      )}

      {/* Tabular Review modal */}
      {showTabular && (
        <TabularReviewView
          workspaceId={workspaceId}
          documents={documents}
          onClose={() => setShowTabular(false)}
        />
      )}

      {/* Share modal */}
      {showShare && (
        <SharePanel
          workspaceId={workspaceId}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Checkpoint modal */}
      {openCheckpointId && (
        <CheckpointDialog
          checkpoint={checkpoints.find((c) => c.id === openCheckpointId)!}
          onResolve={(choice) =>
            handleCheckpointResolve(openCheckpointId, choice)
          }
          onClose={() => setOpenCheckpointId(null)}
        />
      )}
    </>
  );
}

