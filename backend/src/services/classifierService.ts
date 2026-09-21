/**
 * classifierService.ts
 *
 * Lightweight bridge between the Node.js Express backend and the
 * Python FastAPI furniture ML service (EfficientNet-B0).
 *
 * Uses Node 18+ native fetch + FormData — no extra dependencies required.
 *
 * Usage:
 *   const result = await classifyPdfWithMLService(pdfBuffer, "catalogue.pdf");
 *   if (result.status === "ok") {
 *     // result.byPage.get(pageNum) → { category, mlLabel, confidence, mlStatus }
 *   }
 *
 * If the ML service is unreachable the function returns { status: "unavailable" }
 * and the caller should fall back to the existing heuristic classifier.
 */

// ─── Configuration ─────────────────────────────────────────────────────────────
const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL ?? "http://localhost:8000";

const PDF_PROCESS_ENDPOINT = `${ML_SERVICE_URL}/api/v1/pdf/process`;

/** Timeout in milliseconds for the ML service call (default: 5 minutes). */
const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS ?? 5 * 60 * 1000);

// ─── ML label → Coref category mapping ────────────────────────────────────────
/**
 * Maps the ML model's output labels to the Coref product category taxonomy.
 * Both "Office Furniture" and "Villa Furniture" map to "Structural" because
 * the Coref system uses a construction-supply taxonomy, not a furniture-retail one.
 * Admins can always override the category in the review table.
 */
export const ML_LABEL_TO_COREF_CATEGORY: Record<string, string> = {
  "Office Furniture": "Structural",
  "Villa Furniture": "Structural",
  "Chandelier": "Lighting",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PageResult = {
  pageNumber: number;
  /** Coref category (after mapping). */
  category: string;
  /** Raw ML label e.g. "Office Furniture" */
  mlLabel: string;
  /** 0–1 confidence from the model */
  confidence: number;
  /** "classified" | "needs_review" | "failed" */
  mlStatus: string;
};

export type MLClassificationResult =
  | {
      status: "ok";
      sourcePdf: string;
      /** Keyed by 1-based page number */
      byPage: Map<number, PageResult>;
      /** Flat list — one entry per unique classified image */
      results: PageResult[];
      summary: {
        totalPages: number;
        imagesClassified: number;
        needsReview: number;
        byCategory: Record<string, number>;
      };
    }
  | { status: "unavailable" | "error"; reason: string };

// ─── Internal type matching the FastAPI PDFResponse schema ────────────────────

interface MLServiceResponse {
  job_id: string;
  source_pdf: string;
  status: string;
  summary?: {
    total_pages: number;
    images_extracted: number;
    duplicates_removed: number;
    images_classified: number;
    needs_review: number;
    failed: number;
    by_category: Record<string, number>;
    processing_seconds: number;
  };
  results: Array<{
    image_id: string;
    page_number?: number;
    category: string;
    confidence: number;
    status: string;
    image_path?: string | null;
    probabilities?: Record<string, number> | null;
  }>;
}

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Sends the PDF buffer to the Python ML service and returns per-page
 * classification results.
 *
 * @param pdfBuffer  Raw bytes of the uploaded PDF.
 * @param filename   Original filename (used by the ML service for logging).
 * @returns          Classification results, or { status: "unavailable" } on
 *                   connection error.
 */
export async function classifyPdfWithMLService(
  pdfBuffer: Buffer,
  filename: string
): Promise<MLClassificationResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

  try {
    // Build multipart form — mirrors the curl example in the README.
    // Node 18+ has native FormData + Blob; no extra packages needed.
    // We must convert Buffer to a plain ArrayBuffer (not SharedArrayBuffer) for Blob.
    const arrayBuffer = pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength
    ) as ArrayBuffer;
    const form = new FormData();
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });
    form.append("file", blob, filename || "catalogue.pdf");
    form.append("include_probabilities", "false");
    form.append("deduplicate", "true");
    // keep_files=false: we don't want the ML service to persist images on its
    // own disk. The Node backend manages its own /uploads directory.
    form.append("keep_files", "false");

    console.log(
      `[classifierService] POST ${PDF_PROCESS_ENDPOINT} — "${filename}" (${(pdfBuffer.length / 1024).toFixed(0)} KB)`
    );

    const response = await fetch(PDF_PROCESS_ENDPOINT, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(
        `[classifierService] ML service returned HTTP ${response.status}: ${text.slice(0, 200)}`
      );
      return {
        status: "error",
        reason: `HTTP ${response.status}: ${text.slice(0, 200)}`,
      };
    }

    // ─── Parse response ────────────────────────────────────────────────────────
    const data = (await response.json()) as MLServiceResponse;

    const byPage = new Map<number, PageResult>();
    const results: PageResult[] = [];

    for (const item of data.results ?? []) {
      const corefCategory =
        ML_LABEL_TO_COREF_CATEGORY[item.category] ?? "Other";

      const pr: PageResult = {
        pageNumber: item.page_number ?? 0,
        mlLabel: item.category,
        category: corefCategory,
        confidence: item.confidence,
        mlStatus: item.status,
      };

      results.push(pr);
      // If multiple images on the same page, keep the highest-confidence one
      const existing = byPage.get(pr.pageNumber);
      if (!existing || pr.confidence > existing.confidence) {
        byPage.set(pr.pageNumber, pr);
      }
    }

    const categoryCount: Record<string, number> = {};
    for (const r of results) {
      categoryCount[r.category] = (categoryCount[r.category] ?? 0) + 1;
    }

    console.log(
      `[classifierService] Classified ${results.length} images across ` +
        `${data.summary?.total_pages ?? "?"} pages. ` +
        `By category: ${JSON.stringify(categoryCount)}`
    );

    return {
      status: "ok",
      sourcePdf: data.source_pdf ?? filename,
      byPage,
      results,
      summary: {
        totalPages: data.summary?.total_pages ?? 0,
        imagesClassified: data.summary?.images_classified ?? results.length,
        needsReview: data.summary?.needs_review ?? 0,
        byCategory: categoryCount,
      },
    };
  } catch (err: unknown) {
    clearTimeout(timer);

    const errMsg =
      err instanceof Error ? err.message : String(err);
    const errName =
      err instanceof Error ? err.name : "";

    const isConnRefused =
      errMsg.includes("ECONNREFUSED") ||
      errMsg.includes("ETIMEDOUT") ||
      errMsg.includes("fetch failed") ||
      errName === "AbortError";

    if (isConnRefused) {
      console.warn(
        "[classifierService] ML service is not reachable — " +
          "falling back to heuristic classifier. " +
          `Reason: ${errMsg}`
      );
      return {
        status: "unavailable",
        reason:
          "ML service is not running or not reachable at " +
          ML_SERVICE_URL,
      };
    }

    console.error("[classifierService] Unexpected error:", err);
    return {
      status: "error",
      reason: errMsg,
    };
  }
}
