/**
 * HARIS — Tek akış modeli
 *
 * Hem /v2 hem klasik sayfalar aynı adım sırasını ve "sıradaki adım"
 * hesaplamasını kullanır; kullanıcı her yerde nerede olduğunu görür.
 */

export type FlowStepId = "open" | "documents" | "analyze" | "review" | "follow";

export interface FlowStep {
  id: FlowStepId;
  label: string;
  description: string;
}

export const FLOW_STEPS: FlowStep[] = [
  { id: "open", label: "Dosya aç", description: "Dava için çalışma alanı" },
  { id: "documents", label: "Belgeleri ekle", description: "Dilekçe, rapor, karar" },
  { id: "analyze", label: "Analiz", description: "Ajanlar dosyayı inceler" },
  { id: "review", label: "Dilekçeyi incele", description: "Taslağı onaylayın" },
  { id: "follow", label: "Süreleri takip et", description: "Takvime işleyin" },
];

export type OrchestrationStatus =
  | "idle"
  | "running"
  | "paused_for_user"
  | "completed"
  | "error";

export interface WorkspaceProgress {
  id: string;
  orchestrationStatus: OrchestrationStatus | string;
  documentsCount?: number;
  hasPetition?: boolean;
}

export type NextActionTone = "default" | "attention" | "progress";

export interface NextAction {
  step: FlowStepId;
  title: string;
  description: string;
  cta: string;
  href: string;
  tone: NextActionTone;
}

export const NEW_WORKSPACE_HREF = "/v2/workspaces/new";

export const OPEN_CASE_ACTION: NextAction = {
  step: "open",
  title: "İlk dava dosyanızı açın",
  description:
    "Belgelerinizi yükleyin; HARIS davayı tanır ve uygun uzman ajanları görevlendirir.",
  cta: "Yeni dosya aç",
  href: NEW_WORKSPACE_HREF,
  tone: "default",
};

export function stepIndex(step: FlowStepId): number {
  return FLOW_STEPS.findIndex((s) => s.id === step);
}

export function resolveWorkspaceAction(ws: WorkspaceProgress): NextAction {
  const href = `/v2/workspaces/${ws.id}`;

  if (ws.documentsCount === 0) {
    return {
      step: "documents",
      title: "Belgeleri ekleyin",
      description: "Analizin başlayabilmesi için en az bir belge gerekli.",
      cta: "Belge ekle",
      href,
      tone: "attention",
    };
  }

  switch (ws.orchestrationStatus) {
    case "running":
      return {
        step: "analyze",
        title: "Ajanlar dosyanız üzerinde çalışıyor",
        description: "Analiz bitince dilekçe taslağı otomatik olarak açılır.",
        cta: "İlerlemeyi izle",
        href,
        tone: "progress",
      };
    case "paused_for_user":
      return {
        step: "analyze",
        title: "Kararınız bekleniyor",
        description: "Ajanlar arasında bir çelişki var; devam etmek için seçim yapın.",
        cta: "Kararı ver",
        href,
        tone: "attention",
      };
    case "error":
      return {
        step: "analyze",
        title: "Analiz yarıda kaldı",
        description: "Süreci yeniden başlatarak kaldığı yerden devam edebilirsiniz.",
        cta: "Yeniden başlat",
        href,
        tone: "attention",
      };
    case "completed":
      return {
        step: "review",
        title: "Dilekçe taslağı hazır",
        description: "Taslağı inceleyin, onaylayın; ardından süreleri takvime işleyin.",
        cta: "Dilekçeyi incele",
        href,
        tone: "default",
      };
    default:
      return {
        step: "analyze",
        title: "Analizi başlatın",
        description: "Belgeler hazır. Orkestra Şefi ajanları sırayla çalıştıracak.",
        cta: "Analize geç",
        href,
        tone: "default",
      };
  }
}

/** Ana sayfa için: en son üzerinde çalışılan aktif dosyaya göre sıradaki adım. */
export function resolveHomeAction(
  workspaces: Array<{ id: string; status: string; orchestration_status: string }>
): { action: NextAction; workspaceId: string | null } {
  const current = workspaces.find((w) => w.status !== "archived");
  if (!current) return { action: OPEN_CASE_ACTION, workspaceId: null };
  return {
    action: resolveWorkspaceAction({
      id: current.id,
      orchestrationStatus: current.orchestration_status,
    }),
    workspaceId: current.id,
  };
}

/** Açık yönlendirme saldırılarını önlemek için yalnızca uygulama içi yollar. */
export function safeInternalPath(value: unknown, fallback = "/v2"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
