import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast-provider";
import { CookieBanner } from "@/components/legal/cookie-banner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

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
      <body className={`${inter.variable} ${playfair.variable}`}>
        <ToastProvider>{children}<CookieBanner /></ToastProvider>
      </body>
    </html>
  );
}
