"use client";

/**
 * HARIS v2 — Orkestra Şefi Chat Paneli
 *
 * Karar 5 (kullanıcı onaylı):
 *   - @mention destekli (ajan-spesifik sorgulama)
 *   - ⓘ Tooltip + "Detaylı örnekler" linki
 *
 * Karar 8: Her AI yanıtının "Ham yanıt görüntüle" toggle'ı (mesaj başında).
 *
 * Sprint 11.1: UI iskelet + mention dropdown.
 * Sprint 11.4: Gerçek streaming + tool calling.
 */

import { useState, useRef, useEffect } from "react";
import { AGENTS, ALL_AGENT_IDS, type AgentId } from "@/lib/v2/orchestra/agents";
import { MemoryPanel } from "@/components/v2/memory/memory-panel";
import { PartiesPanel } from "@/components/v2/parties/parties-panel";
import { CitationsView, type Citations } from "@/components/v2/chat/citations-view";

interface ChatMessage {
  id: string;
  role: "user" | "orchestrator" | "agent";
  agentId?: AgentId;
  content: string;
  timestamp: string;
  rawResponse?: unknown;
  systemPrompt?: string;
  citations?: Citations;
}

interface OrchestratorChatProps {
  messages: ChatMessage[];
  onSend?: (content: string, mentionedAgents: AgentId[]) => void;
  onClearHistory?: () => Promise<void> | void;
  showRawByDefault?: boolean;
  workspaceId?: string;
  /** Şu an AI cevabı bekleniyor mu (animasyon için) */
  isSending?: boolean;
}

const MENTION_EXAMPLES = [
  {
    title: "Belirli bir ajana doğrudan komut",
    example: "@karşıargüman bu tezimde zayıf gördüğün 3 nokta nedir?",
  },
  {
    title: "İki ajan arasında çapraz inceleme iste",
    example: "@maddi_hukuk ve @usul_hukuku — TBK 49 vs HMK 119 çakışıyor mu?",
  },
  {
    title: "Bir ajanın modelini sorgula",
    example: "@dilekce_editoru hangi modelle çalışıyorsun?",
  },
  {
    title: "Tonu değiştir",
    example: "@dilekce_editoru dili daha kararlı ve saldırgan yap",
  },
];

export function OrchestratorChat({
  messages,
  onSend,
  onClearHistory,
  showRawByDefault = false,
  workspaceId,
  isSending = false,
}: OrchestratorChatProps) {
  const [input, setInput] = useState("");
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [expandedRaw, setExpandedRaw] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    // @ tetikleyicisi
    const lastAtIdx = value.lastIndexOf("@");
    if (lastAtIdx >= 0) {
      const afterAt = value.slice(lastAtIdx + 1);
      // Sadece boşluksuz devam ediyorsa menü göster
      if (!/\s/.test(afterAt)) {
        setShowMentionMenu(true);
        setMentionFilter(afterAt.toLowerCase());
        return;
      }
    }
    setShowMentionMenu(false);
  };

  const insertMention = (agentId: AgentId) => {
    const lastAtIdx = input.lastIndexOf("@");
    const before = input.slice(0, lastAtIdx);
    const after = input.slice(lastAtIdx + mentionFilter.length + 1);
    setInput(`${before}@${agentId} ${after}`);
    setShowMentionMenu(false);
    inputRef.current?.focus();
  };

  const handleSubmit = () => {
    if (!input.trim()) return;
    // @mention'ları çıkar
    const mentions = Array.from(input.matchAll(/@(\w+)/g))
      .map((m) => m[1] as AgentId)
      .filter((id) => ALL_AGENT_IDS.includes(id));
    onSend?.(input, mentions);
    setInput("");
  };

  const filteredAgents = ALL_AGENT_IDS.filter(
    (id) =>
      id.toLowerCase().includes(mentionFilter) ||
      AGENTS[id].displayName.toLowerCase().includes(mentionFilter)
  ).slice(0, 6);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 max-h-[38%] overflow-y-auto overscroll-contain border-b border-white/10">
        {workspaceId && <MemoryPanel workspaceId={workspaceId} />}
        {workspaceId && (
          <div className="px-2 py-1.5">
            <PartiesPanel workspaceId={workspaceId} />
          </div>
        )}
      </div>

      {/* Header — chat hafıza göstergesi + temizle */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-white/[0.02]">
        <div className="text-[10px] text-slate-500">
          💾 {messages.length} mesaj hafızada
          {messages.length > 70 && (
            <span className="ml-1 text-amber-400" title="Son 70 mesaj tam gönderiliyor, öncesi rolling summary">
              (son 50'si aktif + eski özet)
            </span>
          )}
        </div>
        {onClearHistory && messages.length > 1 && (
          <button
            type="button"
            onClick={async () => {
              if (confirm("Chat geçmişini temizle? (Belgeler ve ajan çıktıları kalır)")) {
                await onClearHistory();
              }
            }}
            className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20"
            title="Konuşmayı sıfırla"
          >
            🧹 Temizle
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🎼</div>
            <div className="text-sm text-slate-300 mb-1">
              Merhaba, ben Orkestra Şefi.
            </div>
            <div className="text-xs text-slate-500">
              Bana davanız hakkında soru sorun, ajanlardan birine doğrudan
              komut verin (<code className="text-[#C9A961]">@</code>), ya da
              süreci başlatmamı isteyin.
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              showRaw={expandedRaw[msg.id] ?? showRawByDefault}
              onToggleRaw={() =>
                setExpandedRaw((prev) => ({
                  ...prev,
                  [msg.id]: !(prev[msg.id] ?? showRawByDefault),
                }))
              }
            />
          ))
        )}
        {isSending && (
          <div className="flex gap-2 items-center px-2 py-3 rounded-lg bg-[#C9A961]/5 border border-[#C9A961]/20 animate-pulse">
            <div className="text-lg">🎼</div>
            <div className="flex-1">
              <div className="text-[10px] text-slate-500 mb-1">Orkestra Şefi düşünüyor…</div>
              <div className="flex gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-[#C9A961] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="inline-block w-2 h-2 rounded-full bg-[#C9A961] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="inline-block w-2 h-2 rounded-full bg-[#C9A961] animate-bounce" style={{ animationDelay: "300ms" }} />
                <span className="ml-2 text-[10px] text-slate-500">
                  Belgeleri, hafızayı ve konuşma geçmişini işliyor (10-30 sn)
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-white/10 p-3 relative">
        {/* @mention dropdown */}
        {showMentionMenu && filteredAgents.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 max-h-64 overflow-y-auto rounded-lg border border-white/15 bg-[#0E1B30] shadow-2xl z-10">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 px-3 py-1.5 border-b border-white/5">
              Ajan seç
            </div>
            {filteredAgents.map((id) => {
              const a = AGENTS[id];
              return (
                <button
                  key={id}
                  onClick={() => insertMention(id)}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-white/[0.04]"
                >
                  <span className="text-base">{a.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{a.displayName}</div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {a.capabilities.join(" · ")}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Examples modal */}
        {showExamplesModal && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowExamplesModal(false)}
          >
            <div
              className="bg-[#0E1B30] border border-white/10 rounded-xl max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4 text-[#C9A961]">
                @mention Kullanım Örnekleri
              </h3>
              <div className="space-y-4">
                {MENTION_EXAMPLES.map((ex, i) => (
                  <div key={i}>
                    <div className="text-xs text-slate-400 mb-1">
                      {ex.title}
                    </div>
                    <code className="block text-sm bg-white/[0.04] border border-white/10 rounded p-2 text-slate-200">
                      {ex.example}
                    </code>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowExamplesModal(false)}
                className="mt-6 w-full px-4 py-2 rounded bg-[#C9A961] text-[#0A1628] font-semibold"
              >
                Anladım
              </button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !showMentionMenu &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229
                ) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Mesajınızı yazın… (@ ile ajan çağırın)"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 focus:border-[#C9A961]/50 focus:outline-none focus:ring-1 focus:ring-[#C9A961]/30 text-sm text-slate-100 placeholder:text-slate-500 resize-none"
            />
            {/* @ tooltip */}
            <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500">
              <div
                className="relative cursor-help"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <span>
                  ⓘ <code className="text-[#C9A961]">@</code> ile ajan çağırın
                </span>
                {showTooltip && (
                  <div className="absolute bottom-full left-0 mb-1 w-64 p-2 rounded bg-[#0A1628] border border-white/15 text-[10px] text-slate-300 leading-relaxed z-20 shadow-xl">
                    Belirli bir ajanla doğrudan konuşmak için{" "}
                    <code className="text-[#C9A961]">@</code> yazın. Örnek:{" "}
                    <code className="text-[#C9A961]">
                      @karşıargüman bu çok yumuşak
                    </code>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowExamplesModal(true)}
                className="text-[#C9A961] hover:underline"
              >
                📖 Örnekler
              </button>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isSending}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
              input.trim() && !isSending
                ? "bg-[#C9A961] text-[#0A1628] hover:bg-[#e6c479]"
                : "bg-white/5 text-slate-500 cursor-not-allowed"
            }`}
          >
            {isSending ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-slate-400/40 border-t-slate-100 rounded-full animate-spin" />
            ) : (
              "↑"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  showRaw,
  onToggleRaw,
}: {
  message: ChatMessage;
  showRaw: boolean;
  onToggleRaw: () => void;
}) {
  const isUser = message.role === "user";
  const agent = message.agentId ? AGENTS[message.agentId] : null;
  const emoji = isUser ? "👤" : agent?.emoji ?? "🎼";
  const name = isUser
    ? "Siz"
    : agent?.displayName ?? "Orkestra Şefi";

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className="text-base shrink-0 mt-1">{emoji}</div>
      <div className={`flex-1 ${isUser ? "text-right" : ""}`}>
        <div className="text-[10px] text-slate-500 mb-0.5">
          {name} · {message.timestamp}
        </div>
        <div
          className={`inline-block max-w-full text-sm rounded-lg px-3 py-2 ${
            isUser
              ? "bg-[#C9A961]/10 border border-[#C9A961]/20 text-slate-100"
              : "bg-white/[0.03] border border-white/10 text-slate-200"
          }`}
        >
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>
        {!isUser && message.citations && message.citations.totalHits > 0 && (
          <CitationsView citations={message.citations} />
        )}
        {!isUser && message.rawResponse != null && (
          <div className="mt-1">
            <button
              onClick={onToggleRaw}
              className="text-[10px] text-slate-500 hover:text-[#C9A961]"
            >
              {showRaw ? "▾ Ham yanıtı gizle" : "▸ Ham yanıtı gör"}
            </button>
            {showRaw && (
              <pre className="mt-1 text-[10px] bg-black/30 border border-white/10 rounded p-2 overflow-x-auto max-h-40 text-slate-400">
                {JSON.stringify(message.rawResponse, null, 2) as string}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
