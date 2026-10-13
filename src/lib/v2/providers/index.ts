/**
 * HARIS v2 — Model Provider Registry (Faz 13.5.5)
 *
 * YENİ:
 *   - "opposition" role → GPT-5.6 Sol (karşı argüman için farklı sağlayıcı)
 *   - Adversarial diversity: farklı model + farklı bakış açısı = daha güçlü red-team
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export type ModelRole =
  | "orchestrator"
  | "analyzer"
  | "opposition" // YENİ: Karşı Argüman için (GPT-5.6 Sol)
  | "drafter"
  | "quick"
  // Görsel ANALİZ (yorum). Belgeden metin çıkarma (OCR) bu rolü kullanmaz → ingest/ocr-config.ts
  | "vision";

export interface ModelInfo {
  role: ModelRole;
  provider: "anthropic" | "openai";
  modelId: string;
  displayName: string;
  contextWindow: number;
  costPer1MInput: number;
  costPer1MOutput: number;
  costPer1MCacheWrite?: number;
  costPer1MCacheRead?: number;
  supportsCaching: boolean;
  supportsEffort: boolean;
}

export const MODEL_REGISTRY: Record<ModelRole, ModelInfo> = {
  orchestrator: {
    role: "orchestrator",
    provider: parseProvider(process.env.HARIS_ORCHESTRATOR_MODEL, "anthropic"),
    modelId: parseModelId(process.env.HARIS_ORCHESTRATOR_MODEL, "claude-opus-5"),
    displayName: getDisplayName(process.env.HARIS_ORCHESTRATOR_MODEL, "Claude Opus 5"),
    contextWindow: 200_000,
    costPer1MInput: 5,
    costPer1MOutput: 25,
    costPer1MCacheWrite: 6.25,
    costPer1MCacheRead: 0.5,
    supportsCaching: true,
    supportsEffort: false,
  },
  analyzer: {
    role: "analyzer",
    provider: parseProvider(process.env.HARIS_ANALYZER_MODEL, "anthropic"),
    modelId: parseModelId(process.env.HARIS_ANALYZER_MODEL, "claude-opus-5"),
    displayName: getDisplayName(process.env.HARIS_ANALYZER_MODEL, "Claude Opus 5"),
    contextWindow: 200_000,
    costPer1MInput: 5,
    costPer1MOutput: 25,
    costPer1MCacheWrite: 6.25,
    costPer1MCacheRead: 0.5,
    supportsCaching: true,
    supportsEffort: false,
  },
  // YENİ: Karşı Argüman için farklı model (Adversarial Diversity)
  opposition: {
    role: "opposition",
    provider: parseProvider(process.env.HARIS_OPPOSITION_MODEL, "openai"),
    modelId: parseModelId(process.env.HARIS_OPPOSITION_MODEL, "gpt-5.6-sol"),
    displayName: getDisplayName(process.env.HARIS_OPPOSITION_MODEL, "GPT-5.6 Sol"),
    contextWindow: 128_000,
    costPer1MInput: 5,
    costPer1MOutput: 15,
    supportsCaching: false,
    supportsEffort: false,
  },
  drafter: {
    role: "drafter",
    provider: parseProvider(process.env.HARIS_DRAFTER_MODEL, "anthropic"),
    modelId: parseModelId(process.env.HARIS_DRAFTER_MODEL, "claude-opus-5"),
    displayName: getDisplayName(process.env.HARIS_DRAFTER_MODEL, "Claude Opus 5"),
    contextWindow: 200_000,
    costPer1MInput: 5,
    costPer1MOutput: 25,
    costPer1MCacheWrite: 6.25,
    costPer1MCacheRead: 0.5,
    supportsCaching: true,
    supportsEffort: false,
  },
  quick: {
    role: "quick",
    provider: parseProvider(process.env.HARIS_QUICK_MODEL, "anthropic"),
    modelId: parseModelId(process.env.HARIS_QUICK_MODEL, "claude-sonnet-5"),
    displayName: getDisplayName(process.env.HARIS_QUICK_MODEL, "Claude Sonnet 5"),
    contextWindow: 200_000,
    costPer1MInput: 3,
    costPer1MOutput: 15,
    costPer1MCacheWrite: 3.75,
    costPer1MCacheRead: 0.3,
    supportsCaching: true,
    supportsEffort: false,
  },
  vision: {
    role: "vision",
    provider: parseProvider(process.env.HARIS_VISION_MODEL, "anthropic"),
    modelId: parseModelId(process.env.HARIS_VISION_MODEL, "claude-opus-5"),
    displayName: getDisplayName(process.env.HARIS_VISION_MODEL, "Claude Opus 5 Vision"),
    contextWindow: 200_000,
    costPer1MInput: 5,
    costPer1MOutput: 25,
    supportsCaching: false,
    supportsEffort: false,
  },
};

const hasOpenAI = () => !!process.env.OPENAI_API_KEY?.startsWith("sk-");
const hasAnthropic = () => !!process.env.ANTHROPIC_API_KEY;

export function isDemoMode(): boolean {
  return !hasOpenAI() || !hasAnthropic();
}

export function getChatModel(role: ModelRole): BaseChatModel {
  const info = MODEL_REGISTRY[role];

  if (info.provider === "anthropic") {
    if (!hasAnthropic()) return mockChatModel(info);
    return new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: info.modelId,
      temperature: role === "orchestrator" ? 0.3 : 0.5,
      maxTokens: role === "drafter" ? 16000 : 4000,
      ...(process.env.ANTHROPIC_BASE_URL && {
        clientOptions: { baseURL: process.env.ANTHROPIC_BASE_URL },
      }),
    });
  }

  if (info.provider === "openai") {
    if (!hasOpenAI()) return mockChatModel(info);
    return new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      model: info.modelId,
      temperature: role === "drafter" ? 0.4 : 0.3,
      maxTokens: role === "drafter" ? 16000 : 4000,
    });
  }

  throw new Error(`Bilinmeyen provider: ${info.provider}`);
}

export function getEmbeddings(): OpenAIEmbeddings | null {
  if (!hasOpenAI()) return null;
  return new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY!,
    model: process.env.HARIS_EMBEDDING_MODEL?.split(":")[1] ?? "text-embedding-3-large",
  });
}

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

function parseProvider(spec: string | undefined, def: "anthropic" | "openai"): "anthropic" | "openai" {
  if (!spec) return def;
  const [prov] = spec.split(":");
  if (prov === "anthropic" || prov === "openai") return prov;
  return def;
}

function parseModelId(spec: string | undefined, def: string): string {
  if (!spec) return def;
  const parts = spec.split(":");
  return parts[1] ?? def;
}

function getDisplayName(spec: string | undefined, def: string): string {
  const modelId = parseModelId(spec, "");
  if (!modelId) return def;

  // Popüler modeller için güzel isimler
  const nameMap: Record<string, string> = {
    "claude-opus-5": "Claude Opus 5",
    "claude-opus-4-8": "Claude Opus 4.8",
    "claude-opus-4-7": "Claude Opus 4.7",
    "claude-opus-4-6": "Claude Opus 4.6",
    "claude-sonnet-5": "Claude Sonnet 5",
    "claude-sonnet-4-6": "Claude Sonnet 4.6",
    "claude-fable-5": "Claude Fable 5",
    "claude-mythos-5": "Claude Mythos 5",
    "claude-haiku-4-5": "Claude Haiku 4.5",
    "gpt-5.6-sol": "GPT-5.6 Sol",
    "gpt-5.6-sol-ultra": "GPT-5.6 Sol Ultra",
    "gpt-5.6-terra": "GPT-5.6 Terra",
    "gpt-5.6-luna": "GPT-5.6 Luna",
    "gpt-5.5": "GPT-5.5",
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o mini",
  };

  return nameMap[modelId] || modelId;
}

function mockChatModel(info: ModelInfo): BaseChatModel {
  const ChatOpenAIMock = ChatOpenAI as unknown as new (
    config: Record<string, unknown>
  ) => BaseChatModel;
  return new ChatOpenAIMock({
    apiKey: "mock-key",
    model: info.modelId,
    configuration: { baseURL: "http://localhost:9999/mock" },
  });
}
