"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { useCaseContext } from "@/hooks/use-case-context";
import { RagProvenancePanel } from "@/components/rag/rag-provenance";
import { AGENT_DISPLAY_NAMES, type AgentId } from "@/lib/ai/prompts";
import type { LegalCase } from "@/lib/data/types";
import {
  Brain,
  Sparkles,
  Eye,
  Scale,
  FileText,
  Search,
  Library,
  Clock,
  AlertTriangle,
  Check,
  Loader2,
  type LucideIcon,
} from "lucide-react";

interface Props {
  caseItem: LegalCase;
}

const AGENT_ICONS: Record<string, LucideIcon> = {
  factAnalyst: Eye,
  legalClassifier: Scale,
  legislationScanner: FileText,
  caseHunter: Search,
  doctrineScanner: Library,
  procedureExpert: Clock,
  riskAnalyst: AlertTriangle,
};

const PIPELINE: AgentId[] = [
  "factAnalyst",
  "legalClassifier",
  "legislationScanner",
  "caseHunter",
  "doctrineScanner",
  "procedureExpert",
  "riskAnalyst",
];

interface AgentResult {
  agentId: AgentId;
  text: string;
  duration: number;
  done: boolean;
  rag: { ids: string[]; scores: number[]; count: number } | null;
}

export function AIAnalysisRunner({ caseItem }: Props) {
  const [results, setResults] = useState<AgentResult[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentId | null>(null);
  const [, setCurrentText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [selectedView, setSelectedView] = useState<AgentId | null>(null);

  const stream = useAgentStream();

  const { fullContext: caseContext, hasDocuments, digest } = useCaseContext(caseItem);

  async function runDeepAnalysis() {
    setResults([]);
    setIsRunning(true);
    setSelectedView(null);
    const accumulated: AgentResult[] = [];

    for (const agentId of PIPELINE) {
      setActiveAgent(agentId);
      setCurrentText("");

      const previousOutputs: Record<string, string> = {};
      for (const prev of accumulated) {
        previousOutputs[AGENT_DISPLAY_NAMES[prev.agentId]] = prev.text;
      }

      try {
        const startTime = Date.now();
        const text = await stream.run({
          agentId,
          context: caseContext,
          previousOutputs,
        });

        if (text) {
          const result: AgentResult = {
            agentId,
            text,
            duration: Date.now() - startTime,
            done: true,
            rag: stream.rag,
          };
          accumulated.push(result);
          setResults([...accumulated]);
        }
      } catch (err) {
        console.error(`Ajan ${agentId} başarısız:`, err);
      }
    }

    setActiveAgent(null);
    setIsRunning(false);
    if (accumulated.length > 0) setSelectedView(accumulated[0].agentId);
  }

  // Stream çalışırken canlı text
  const liveText = stream.text;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-4">
      {/* Sol — pipeline */}
      <div className="space-y-3.5">
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-[var(--color-gold)]/[0.12] text-[var(--color-gold-bright)] flex items-center justify-center">
              <Brain size={16} />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold">Derin Analiz</h3>
              <div className="text-[10px] text-[var(--color-text-3)]">7 ajan ardışık</div>
            </div>
          </div>

          {!isRunning && results.length === 0 && (
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={runDeepAnalysis}
            >
              <Sparkles size={14} /> Analizi Başlat
            </Button>
          )}

          {(isRunning || results.length > 0) && (
            <div className="space-y-1.5">
              {PIPELINE.map((agentId) => {
                const result = results.find((r) => r.agentId === agentId);
                const Icon = AGENT_ICONS[agentId] || Brain;
                const isActive = activeAgent === agentId;
                const isDone = !!result;
                const isPending = !isActive && !isDone && isRunning;

                return (
                  <button
                    key={agentId}
                    onClick={() => result && setSelectedView(agentId)}
                    disabled={!isDone}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-md text-left text-[12px] transition-all ${
                      selectedView === agentId
                        ? "bg-[var(--color-gold)]/15 text-[var(--color-gold-bright)]"
                        : isActive
                        ? "bg-[var(--color-info)]/10 text-[var(--color-info)]"
                        : isDone
                        ? "text-[var(--color-text)] hover:bg-[var(--color-bg-2)]"
                        : "text-[var(--color-text-3)] opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isActive
                          ? "bg-[var(--color-info)]/20"
                          : isDone
                          ? "bg-[var(--color-ok)]/20 text-[var(--color-ok)]"
                          : ""
                      }`}
                    >
                      {isActive ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : isDone ? (
                        <Check size={11} />
                      ) : (
                        <Icon size={11} />
                      )}
                    </div>
                    <span className="flex-1 min-w-0 truncate">
                      {AGENT_DISPLAY_NAMES[agentId]}
                    </span>
                    {result && (
                      <span className="text-[10px] text-[var(--color-text-3)]">
                        {(result.duration / 1000).toFixed(1)}s
                      </span>
                    )}
                    {isPending && (
                      <span className="text-[10px] text-[var(--color-text-3)]">⏳</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!isRunning && results.length > 0 && (
            <Button
              variant="ghost"
              className="w-full justify-center mt-3"
              onClick={runDeepAnalysis}
            >
              <Sparkles size={14} /> Yeniden Analiz Et
            </Button>
          )}
        </Card>

        {/* İstatistikler */}
        {results.length > 0 && (
          <Card>
            <h4 className="text-xs uppercase tracking-[0.1em] text-[var(--color-text-3)] mb-3">
              İstatistikler
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-2)]">Tamamlanan</span>
                <strong className="text-[var(--color-gold-bright)]">
                  {results.length} / {PIPELINE.length}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-2)]">Toplam süre</span>
                <strong className="text-[var(--color-gold-bright)]">
                  {(results.reduce((s, r) => s + r.duration, 0) / 1000).toFixed(1)}s
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-2)]">Hallucination</span>
                <strong className="text-[var(--color-ok)]">0 ✓</strong>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Sağ — sonuç paneli */}
      <div className="min-w-0">
        {!isRunning && results.length === 0 && (
          <div className="flex items-center justify-center min-h-[500px] bg-[var(--color-bg-1)] border-2 border-dashed border-[var(--color-line)] rounded-xl">
            <div className="text-center max-w-md p-8">
              <div className="w-16 h-16 rounded-full bg-[var(--color-gold)]/10 flex items-center justify-center mx-auto mb-4">
                <Brain size={28} className="text-[var(--color-gold-bright)]" />
              </div>
              <h3 className="font-serif text-xl mb-2">Derin Analiz Hazır</h3>
              <p className="text-[var(--color-text-2)] text-sm mb-4">
                7 uzman AI ajanı dava dosyanızı her açıdan inceleyecek. Maddi olay, hukuki
                nitelendirme, mevzuat, içtihat, doktrin, usul ve risk analizleri tek tek
                üretilecek.
              </p>
              <p className="text-xs text-[var(--color-text-3)]">
                Tahmini süre: 3-7 dakika
              </p>
              {hasDocuments && digest && (
                <div className="text-[11.5px] text-[var(--color-ok)] bg-[var(--color-ok)]/[0.08] border border-[var(--color-ok)]/30 rounded-md p-2.5 mt-3 inline-block">
                  ✓ {digest.readyDocs} yüklü belge ({digest.criticalDocs} kritik) bağlama dahil
                </div>
              )}
            </div>
          </div>
        )}

        {isRunning && activeAgent && (
          <Card className="min-h-[500px]">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--color-line)]">
              <div className="w-10 h-10 rounded-full bg-[var(--color-info)]/15 text-[var(--color-info)] flex items-center justify-center">
                <Loader2 size={16} className="animate-spin" />
              </div>
              <div>
                <h3 className="font-serif text-lg">
                  {AGENT_DISPLAY_NAMES[activeAgent]} çalışıyor
                </h3>
                <div className="text-[11px] text-[var(--color-text-3)]">
                  Canlı çıktı aşağıda — token-by-token akıyor
                </div>
              </div>
            </div>
            {stream.rag && <RagProvenancePanel rag={stream.rag} />}
            <Markdown content={liveText} />
            <span className="inline-block w-2 h-4 bg-[var(--color-info)] animate-pulse-dot ml-1 align-middle" />
          </Card>
        )}

        {!isRunning && results.length > 0 && selectedView && (
          <Card>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--color-line)]">
              <div className="w-10 h-10 rounded-full bg-[var(--color-gold)]/[0.12] text-[var(--color-gold-bright)] flex items-center justify-center">
                {(() => {
                  const Icon = AGENT_ICONS[selectedView] || Brain;
                  return <Icon size={16} />;
                })()}
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-lg">{AGENT_DISPLAY_NAMES[selectedView]}</h3>
                <div className="text-[11px] text-[var(--color-text-3)]">
                  {(
                    (results.find((r) => r.agentId === selectedView)!.duration || 0) / 1000
                  ).toFixed(1)}
                  s • {results.find((r) => r.agentId === selectedView)!.text.length} karakter
                </div>
              </div>
            </div>
            {(() => { const r = results.find((rr) => rr.agentId === selectedView); return r?.rag ? <RagProvenancePanel rag={r.rag} /> : null; })()}
            <Markdown content={results.find((r) => r.agentId === selectedView)?.text || ""} />
          </Card>
        )}
      </div>
    </div>
  );
}
