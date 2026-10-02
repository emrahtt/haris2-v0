import { NextRequest } from "next/server";
import { z } from "zod";
import { runJob } from "@/lib/scraping/job-runner";
import type { ScrapingJobInput } from "@/lib/scraping/types";
import { getCurrentUserId } from "@/lib/v2/workspace/auth";
import { checkScrapingLimit, incrementUsage } from "@/lib/billing/subscriptions-db";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 dakika
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  source: z.enum([
    "demo",
    "yargitay",
    "danistay",
    "aym",
    "aihm",
    "mevzuat_gov_tr",
  ]),
  query: z.string().optional(),
  filterCourt: z.string().optional(),
  filterDateFrom: z.string().optional(),
  filterDateTo: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

/**
 * POST /api/scraping/run
 *
 * Yeni scraping job başlatır ve sonuçları SSE/text stream olarak gönderir.
 *
 * Stream format (her satır JSON):
 *   {"type":"progress","payload":{"found":10,"scraped":3,"indexed":2}}
 *   {"type":"decision","payload":{...}}
 *   {"type":"indexed","payload":{"ragId":"...","totalIndexed":N}}
 *   {"type":"done","payload":{...}}
 *   {"type":"error","payload":{...}}
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Geçersiz istek", details: parsed.error.flatten() }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const userId = await getCurrentUserId();
    const limitCheck = await checkScrapingLimit(userId);
    if (!limitCheck.allowed) {
      return new Response(
        JSON.stringify({ error: limitCheck.reason, limit: limitCheck }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
    await incrementUsage("scraping_jobs", 1, userId);

    const input: ScrapingJobInput = {
      ...parsed.data,
      triggerType: "manual",
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of runJob(input)) {
            controller.enqueue(
              encoder.encode(JSON.stringify(event) + "\n")
            );
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                payload: {
                  errorMessage:
                    err instanceof Error ? err.message : "Bilinmeyen hata",
                },
              }) + "\n"
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Job başlatılamadı",
        message: err instanceof Error ? err.message : "x",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
