/**
 * POST /api/v2/workspaces/[id]/documents
 *   FormData: files[] + (opsiyonel) extractionMethod
 * DELETE /api/v2/workspaces/[id]/documents?docId=X
 * PATCH /api/v2/workspaces/[id]/documents?docId=X — retry
 */

import { uuid } from "@/lib/v2/utils/uuid";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/v2/workspace/auth";
import {
  addDocument,
  updateDocument,
  deleteDocument,
  listDocuments,
  getWorkspace,
} from "@/lib/v2/workspace/db";
import {
  extractFromFile,
  type ExtractionMethod,
} from "@/lib/v2/ingest/extract";
import { classifyDocument } from "@/lib/v2/ingest/classify";
import { extractAndStoreEntities } from "@/lib/v2/memory/extractor";
import { indexDocument, logIndexingStats } from "@/lib/v2/rag/indexer";
import { uploadDocumentToStorage } from "@/lib/v2/storage/upload";
import type { VaultDocument } from "@/lib/v2/state/workspace-state";
import { assertUserCanUseAi, consumeAiCall } from "@/lib/billing/gate";
import { incrementUsage } from "@/lib/billing/subscriptions-db";

export const runtime = "nodejs";
export const maxDuration = 300;

const VALID_METHODS: ExtractionMethod[] = [
  "auto",
  "fast",
  "claude_vision",
  "openai_vision",
  "gemini_vision",
  "best_of_3",
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const ws = await getWorkspace(id, userId);
  if (!ws) {
    return NextResponse.json({ error: "Workspace bulunamadı" }, { status: 404 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  const methodRaw = formData.get("extractionMethod") as string | null;
  const extractionMethod: ExtractionMethod = VALID_METHODS.includes(
    methodRaw as ExtractionMethod
  )
    ? (methodRaw as ExtractionMethod)
    : "auto";

  if (files.length === 0) {
    return NextResponse.json({ error: "Dosya yok" }, { status: 400 });
  }

  const needsAi = extractionMethod !== "fast";
  if (needsAi) {
    const quota = await assertUserCanUseAi(userId, files.length);
    if (!quota.allowed) {
      return NextResponse.json({ error: quota.reason, quota }, { status: 402 });
    }
  }

  const records: { doc: VaultDocument; buffer: Buffer }[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const doc: VaultDocument = {
      id: uuid(),
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
      status: "extracting",
    };
    await addDocument(id, userId, doc);
    records.push({ doc, buffer });
  }

  await Promise.all(
    records.map(async ({ doc, buffer }) => {
      try {
        const uploadResult = await uploadDocumentToStorage(
          userId,
          id,
          doc.id,
          doc.filename,
          buffer,
          doc.mimeType
        );
        if (uploadResult.error) {
          console.warn(`[Storage uyarı] ${doc.filename}: ${uploadResult.error}`);
        }

        await updateDocument(id, doc.id, { status: "extracting" });
        const result = await extractFromFile(
          doc.filename,
          doc.mimeType,
          buffer,
          extractionMethod
        );

        if (result.usedAI) await consumeAiCall(userId, 1);
        await incrementUsage("documents_uploaded", 1, userId);

        if (result.incomplete || !result.text || result.text.length < 10) {
          await updateDocument(id, doc.id, {
            status: "error",
            errorMessage:
              result.userMessage || "Belgeden anlamlı metin çıkarılamadı.",
            errorDetail: result.error,
            extractionMethod: result.method,
            modelUsed: result.modelUsed,
            extractionDurationMs: result.durationMs,
            pageCount: result.pageCount,
          });
          return;
        }

        await updateDocument(id, doc.id, {
          status: "classifying",
          extractedText: result.text.slice(0, 100_000),
          extractionMethod: result.method,
          modelUsed: result.modelUsed,
          extractionCost: result.estimatedCost,
          extractionDurationMs: result.durationMs,
          pageCount: result.pageCount,
        });

        const cls = await classifyDocument(doc.filename, result.text);

        await updateDocument(id, doc.id, {
          status: "ready",
          category: cls.category,
          summary: cls.summary,
          extractedText: result.text.slice(0, 100_000),
          extractionMethod: result.method,
          modelUsed: result.modelUsed,
          extractionCost: result.estimatedCost,
          extractionDurationMs: result.durationMs,
          pageCount: result.pageCount,
          errorMessage: result.userMessage,
        });

        // AUTO ENTITY EXTRACT — belgeden davacı/davalı/tutar/tarih gibi bilgileri
        // otomatik çıkarıp matter_memory'ye yaz (hata sessiz)
        try {
          const extractStats = await extractAndStoreEntities(
            id,
            userId,
            doc.id,
            doc.filename,
            result.text,
            cls.category
          );
          console.log(
            `[Auto-extract] ${doc.filename}: ${extractStats.entities} entity, ${extractStats.facts} fact eklendi`
          );
        } catch (extractErr) {
          console.warn("[Auto-extract hatası]", extractErr);
        }

        // FAZ 13.6: RAG INDEXING — belge içeriğini chunk + embed edip
        // workspace_document_chunks'a yaz. Semantic search için gerekli.
        try {
          const indexStats = await indexDocument({
            workspaceId: id,
            documentId: doc.id,
            text: result.text,
            metadata: {
              filename: doc.filename,
              category: cls.category,
              mimeType: doc.mimeType,
            },
          });
          logIndexingStats(doc.filename, indexStats);
        } catch (indexErr) {
          console.warn("[RAG index hatası]", indexErr);
        }
      } catch (e) {
        await updateDocument(id, doc.id, {
          status: "error",
          errorMessage: `İşleme hatası: ${String(e).slice(0, 200)}`,
          errorDetail: String(e),
        });
      }
    })
  );

  return NextResponse.json(
    {
      uploaded: records.length,
      method: extractionMethod,
      documents: records.map((r) => ({
        id: r.doc.id,
        filename: r.doc.filename,
      })),
    },
    { status: 201 }
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const docId = req.nextUrl.searchParams.get("docId");
  if (!docId) {
    return NextResponse.json({ error: "docId eksik" }, { status: 400 });
  }
  const ws = await getWorkspace(id, userId);
  if (!ws) {
    return NextResponse.json({ error: "Workspace yok" }, { status: 404 });
  }
  try {
    await deleteDocument(id, docId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const docId = req.nextUrl.searchParams.get("docId");
  if (!docId) {
    return NextResponse.json({ error: "docId eksik" }, { status: 400 });
  }
  const ws = await getWorkspace(id, userId);
  if (!ws) {
    return NextResponse.json({ error: "Workspace yok" }, { status: 404 });
  }
  const docs = await listDocuments(id);
  const doc = docs.find((d) => d.id === docId);
  if (!doc) {
    return NextResponse.json({ error: "Belge yok" }, { status: 404 });
  }
  await updateDocument(id, docId, {
    status: "error",
    errorMessage:
      "🔄 Belgeyi silip 'Belge Ekle' ile farklı bir yöntem seçerek tekrar yükleyin.",
  });
  return NextResponse.json({ ok: true });
}
