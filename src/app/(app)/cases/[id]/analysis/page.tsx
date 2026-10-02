import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AIAnalysisRunner } from "@/components/case/ai-analysis-runner";
import { getCaseFromDb as getCase } from "@/lib/data/cases-db";
import { CITATIONS, RISKS } from "@/lib/data/legal";
import {
  Brain,
  Sparkles,
  Shield,
  Search,
  Check,
  AlertTriangle,
  Zap,
  Flame,
} from "lucide-react";

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCase(id);
  if (!c) notFound();

  return (
    <div className="space-y-6">
      {/* GERÇEK ZAMANLI AI ANALİZ STUDIO */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-[var(--color-gold-bright)]" />
          <h2 className="font-serif text-lg">Canlı AI Analiz Studio</h2>
          <span className="text-[10px] bg-[var(--color-gold)]/15 text-[var(--color-gold-bright)] px-2 py-0.5 rounded-xl">
            FAZ 3 — YENİ
          </span>
        </div>
        <p className="text-[var(--color-text-2)] text-[13px] mb-4">
          7 uzman AI ajanını sırayla çalıştır, her birinin çıktısını canlı izle. Streaming
          ile gerçek zamanlı üretim — yan tarafta önceki analiz raporunu görebilirsin.
        </p>
        <AIAnalysisRunner caseItem={c} />
      </section>

      {/* ÖNCEDEN HAZIRLANMIŞ STATİK RAPOR */}
      <details className="group" open>
        <summary className="cursor-pointer flex items-center gap-2 mb-3 list-none">
          <Brain size={16} className="text-[var(--color-gold-bright)]" />
          <h2 className="font-serif text-lg">Önceki Analiz Raporu</h2>
          <span className="text-[10px] text-[var(--color-text-3)]">(referans)</span>
          <span className="ml-auto text-xs text-[var(--color-text-3)] group-open:rotate-90 transition-transform">
            ▶
          </span>
        </summary>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4.5">
          <Card>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--color-line)]">
              <div className="w-11 h-11 rounded-full bg-[var(--color-gold)]/[0.12] text-[var(--color-gold-bright)] flex items-center justify-center">
                <Brain size={20} />
              </div>
              <div>
                <h2 className="font-serif text-[22px]">Derin Dava Analiz Raporu</h2>
                <div className="text-[11.5px] text-[var(--color-text-3)] mt-1">
                  12 ajan tarafından 7 dakika 22 saniyede üretildi • 47 emsal karar tarandı
                </div>
              </div>
            </div>

            <ReportSection title="Yönetici Özeti" icon={Sparkles}>
              <p>
                Müvekkil, kusuru kanıtlanmış bir trafik kazası nedeniyle{" "}
                <strong>%32 oranında kalıcı iş gücü kaybına</strong> uğramıştır. Borçlar
                Kanunu m.49 ve KTK m.85 kapsamında, davalının{" "}
                <strong className="text-[var(--color-gold-bright)]">
                  kusursuz sorumluluk
                </strong>{" "}
                rejimi gereği tazminat sorumluluğu doğmuştur.
                <Citation>[Yarg. 17. HD, 2022/4521]</Citation>
              </p>
              <p>
                Davanın <strong>%78 başarı olasılığı</strong> taşıdığı değerlendirilmektedir.
              </p>
            </ReportSection>

            <ReportSection title="SWOT Analizi" icon={Shield}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SwotCard
                  type="s"
                  title="Güçlü Yönler"
                  items={[
                    "Resmi kaza tespit tutanağı ile kusur kesinleşmiş",
                    "ATK raporu — kalıcı maluliyet sabit",
                    "3 görgü tanığı + kamera kaydı mevcut",
                  ]}
                />
                <SwotCard
                  type="w"
                  title="Zayıf Yönler"
                  items={[
                    "Tanık #2 beyanında çelişki",
                    "Kaza öncesi bel fıtığı raporu",
                  ]}
                />
                <SwotCard
                  type="o"
                  title="Fırsatlar"
                  items={[
                    "Davalı şirket halka açık — itibar baskısı",
                    "Manevi tazminat tavanı yükseliyor",
                  ]}
                />
                <SwotCard
                  type="t"
                  title="Tehditler"
                  items={[
                    "Davalı tahkim yoluna başvurabilir",
                    "Yeniden bilirkişi talebi",
                  ]}
                />
              </div>
            </ReportSection>

            <ReportSection title="En Güçlü 5 Emsal Karar" icon={Search}>
              {CITATIONS.map((cite, i) => (
                <div
                  key={i}
                  className="p-3.5 bg-[var(--color-bg-2)] rounded-lg mb-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                    <strong className="text-[var(--color-gold-bright)] text-[12.5px]">
                      {cite.court}
                    </strong>
                    <span className="font-mono text-[11.5px] text-[var(--color-text-2)]">
                      {cite.no}
                    </span>
                    <span className="ml-auto text-[11px] text-[var(--color-ok)]">
                      %{cite.relevance} benzerlik
                    </span>
                  </div>
                  <p className="text-[12.5px] m-0 text-[var(--color-text-2)]">
                    {cite.title}
                  </p>
                </div>
              ))}
            </ReportSection>
          </Card>

          <div className="space-y-3.5">
            <Card>
              <h3 className="font-serif text-[var(--color-gold-bright)] mb-3.5 text-[15px]">
                Analiz İstatistikleri
              </h3>
              {[
                ["Başarı olasılığı", `%${c.successProb}`],
                ["Taranan içtihat", "47"],
                ["Seçilen emsal", "8"],
                ["Çalışan ajan", "12 / 12"],
                ["Hallucination", "0 ✓"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between items-center py-2.5 border-b border-[var(--color-line)] last:border-0 text-[12.5px]"
                >
                  <span>{k}</span>
                  <span
                    className={`font-semibold ${
                      v === "0 ✓"
                        ? "text-[var(--color-ok)]"
                        : "text-[var(--color-gold-bright)]"
                    }`}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </Card>

            <Card>
              <h3 className="font-serif text-[var(--color-gold-bright)] mb-3.5 text-[15px]">
                Risk Haritası
              </h3>
              {RISKS.map((r) => (
                <div key={r.name} className="mb-2.5">
                  <div className="flex justify-between text-xs mb-1">
                    <span>{r.name}</span>
                    <strong
                      className={
                        r.level === "low"
                          ? "text-[var(--color-ok)]"
                          : r.level === "mid"
                          ? "text-[var(--color-warn)]"
                          : "text-[var(--color-danger)]"
                      }
                    >
                      %{r.percent}
                    </strong>
                  </div>
                  <div className="w-full h-1 bg-[var(--color-bg-3)] rounded-sm overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${r.percent}%`,
                        background:
                          r.level === "low"
                            ? "var(--color-ok)"
                            : r.level === "mid"
                            ? "var(--color-warn)"
                            : "var(--color-danger)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </Card>

            <Card>
              <h3 className="font-serif text-[var(--color-gold-bright)] mb-3.5 text-[15px]">
                Sonraki Adımlar
              </h3>
              <ol className="pl-4.5 text-[12.5px] text-[var(--color-text-2)] leading-7 list-decimal">
                <li>
                  <strong className="text-[var(--color-text)]">
                    Cevaba cevap dilekçesi
                  </strong>{" "}
                  üret (12 gün)
                </li>
                <li>Sigorta şirketine doğrudan ihbar gönder</li>
                <li>Tanık #2 beyanını revize et</li>
                <li>Kazanç kaybı için PMF tablosu hazırla</li>
              </ol>
              <Link href={`/cases/${c.id}/draft`}>
                <Button variant="primary" className="w-full justify-center mt-3.5">
                  <Sparkles size={14} /> Hemen Dilekçe Üret
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </details>
    </div>
  );
}

function ReportSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-7">
      <h3 className="text-lg font-serif text-[var(--color-gold-bright)] mb-3 pb-2 border-b border-[var(--color-line)] flex items-center gap-2.5">
        <Icon size={18} />
        {title}
      </h3>
      <div className="text-[var(--color-text-2)] leading-7 text-[13.5px] space-y-3">
        {children}
      </div>
    </div>
  );
}

function Citation({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[var(--color-gold-bright)] cursor-pointer text-[11px] bg-[var(--color-gold)]/10 px-1.5 py-px rounded-sm mx-0.5 align-super">
      {children}
    </span>
  );
}

function SwotCard({
  type,
  title,
  items,
}: {
  type: "s" | "w" | "o" | "t";
  title: string;
  items: string[];
}) {
  const config = {
    s: { bg: "bg-[var(--color-ok)]/[0.05]", border: "border-[var(--color-ok)]/20", color: "text-[var(--color-ok)]", icon: Check },
    w: { bg: "bg-[var(--color-danger)]/[0.05]", border: "border-[var(--color-danger)]/20", color: "text-[var(--color-danger)]", icon: AlertTriangle },
    o: { bg: "bg-[var(--color-info)]/[0.05]", border: "border-[var(--color-info)]/20", color: "text-[var(--color-info)]", icon: Zap },
    t: { bg: "bg-[var(--color-warn)]/[0.05]", border: "border-[var(--color-warn)]/20", color: "text-[var(--color-warn)]", icon: Flame },
  }[type];
  const Icon = config.icon;
  return (
    <div className={`p-3.5 rounded-lg border ${config.bg} ${config.border}`}>
      <h4 className={`text-[13px] mb-2 font-sans font-semibold flex items-center gap-2 ${config.color}`}>
        <Icon size={14} />
        {title}
      </h4>
      <ul className="list-none p-0">
        {items.map((item, i) => (
          <li
            key={i}
            className="text-xs text-[var(--color-text-2)] py-1 pl-4 relative before:content-['▸'] before:absolute before:left-0 before:text-[var(--color-gold)]"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
