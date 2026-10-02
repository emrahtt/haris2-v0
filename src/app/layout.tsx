import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/toast-provider";
import { CookieBanner } from "@/components/legal/cookie-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: "HARIS — Davanın Yorulmaz Bekçisi | AI Destekli Hukuk Zekâsı",
  description:
    "Bir hukuk ofisinin aylarca yapacağı işi saatler içinde. 12 uzman AI ajanı, Türk hukukuna özel RAG, Karşı Taraf Simülatörü ile üstüne söz söylenemeyecek dilekçeler.",
  keywords: [
    "hukuk yazılımı",
    "AI dilekçe",
    "avukat asistanı",
    "Yargıtay araştırma",
    "yapay zeka hukuk",
    "Türk hukuku",
  ],
  authors: [{ name: "HARIS Legal AI" }],
  openGraph: {
    title: "HARIS — Davanın Yorulmaz Bekçisi",
    description:
      "12 uzman AI ajanı ile çalışan, Türk hukukuna özel agentic hukuk platformu.",
    locale: "tr_TR",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router root layout applies to every page */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ToastProvider>{children}<CookieBanner /></ToastProvider>
      </body>
    </html>
  );
}
