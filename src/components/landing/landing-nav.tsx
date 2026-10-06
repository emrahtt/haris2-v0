"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function LandingNav() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[rgba(7,17,31,0.7)] border-b border-[var(--color-line)] px-[5%] py-4 flex items-center justify-between">
      <Logo />
      <div className="hidden md:flex gap-7 items-center">
        <a
          href="#features"
          className="text-[var(--color-text-2)] hover:text-[var(--color-gold-bright)] text-[13px] transition-colors"
        >
          Özellikler
        </a>
        <a
          href="#agents"
          className="text-[var(--color-text-2)] hover:text-[var(--color-gold-bright)] text-[13px] transition-colors"
        >
          Ajan Mimarisi
        </a>
        <a
          href="#compare"
          className="text-[var(--color-text-2)] hover:text-[var(--color-gold-bright)] text-[13px] transition-colors"
        >
          Karşılaştırma
        </a>
        <a
          href="#pricing"
          className="text-[var(--color-text-2)] hover:text-[var(--color-gold-bright)] text-[13px] transition-colors"
        >
          Fiyatlandırma
        </a>
        <Link href="/login">
          <Button variant="ghost" size="sm">
            Giriş
          </Button>
        </Link>
        <Link href="/v2">
          <Button variant="primary" size="sm">
            Demoyu Dene <ArrowRight size={14} />
          </Button>
        </Link>
      </div>
    </nav>
  );
}
