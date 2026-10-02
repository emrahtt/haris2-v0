import { NextResponse } from "next/server";
import { getCurrentSubscription, getCurrentUsage } from "@/lib/billing/subscriptions-db";
import { getPlan } from "@/lib/billing/plans";
import { activeProvider } from "@/lib/billing/config";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode, DEMO_USER } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/billing/status
 *
 * Kullanıcının mevcut planı + kullanım istatistikleri + limit durumu
 */
export async function GET() {
  let userId = DEMO_USER.id;

  if (!isDemoMode) {
    const supabase = await createClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) userId = user.id;
    }
  }

  const sub = await getCurrentSubscription(userId);
  const usage = await getCurrentUsage(userId);
  const plan = getPlan(sub.planId);

  return NextResponse.json({
    subscription: sub,
    usage,
    plan: {
      id: plan.id,
      name: plan.name,
      displayName: plan.displayName,
      priceMonthlyTRY: plan.priceMonthlyTRY,
      limits: plan.limits,
    },
    quotas: {
      aiCalls: {
        used: usage.aiCalls,
        limit: plan.limits.monthlyAiCalls,
        remaining: Math.max(0, plan.limits.monthlyAiCalls - usage.aiCalls),
        percentage: Math.min(
          100,
          Math.round((usage.aiCalls / plan.limits.monthlyAiCalls) * 100)
        ),
      },
      scrapingJobs: {
        used: usage.scrapingJobs,
        limit: plan.limits.monthlyScrapingJobs,
        remaining: Math.max(0, plan.limits.monthlyScrapingJobs - usage.scrapingJobs),
      },
      cases: {
        used: 0, // Hesaplama: ayrı sorgu gerektiriyor — şimdilik 0
        limit: plan.limits.maxCases,
      },
    },
    provider: activeProvider(),
  });
}
