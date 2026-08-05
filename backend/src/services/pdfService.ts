import pdf from "pdf-parse";

export type ParsedProductSuggestion = {
  name: string;
  category: string;
  supplier?: string;
  fobPrice?: string;
  leadTime?: string;
};

// ─── Category keyword map ──────────────────────────────────────────────────────
const CATEGORY_KEYWORDS: Record<string, string> = {
  // Tiles & Flooring
  tile: "Tiles & Flooring",
  tiles: "Tiles & Flooring",
  flooring: "Tiles & Flooring",
  porcelain: "Tiles & Flooring",
  ceramic: "Tiles & Flooring",
  mosaic: "Tiles & Flooring",
  slab: "Tiles & Flooring",
  marble: "Tiles & Flooring",
  granite: "Tiles & Flooring",
  travertine: "Tiles & Flooring",
  vitrified: "Tiles & Flooring",
  // Sanitaryware
  sanitary: "Sanitaryware",
  sanitaryware: "Sanitaryware",
  basin: "Sanitaryware",
  faucet: "Sanitaryware",
  tap: "Sanitaryware",
  toilet: "Sanitaryware",
  shower: "Sanitaryware",
  valve: "Sanitaryware",
  plumbing: "Sanitaryware",
  bathtub: "Sanitaryware",
  // Machinery
  machinery: "Machinery",
  machine: "Machinery",
  pump: "Machinery",
  motor: "Machinery",
  conveyor: "Machinery",
  equipment: "Machinery",
  compressor: "Machinery",
  generator: "Machinery",
  // Lighting
  lighting: "Lighting",
  light: "Lighting",
  lamp: "Lighting",
  led: "Lighting",
  fixture: "Lighting",
  luminaire: "Lighting",
  chandelier: "Lighting",
  spotlight: "Lighting",
  // Structural
  steel: "Structural",
  concrete: "Structural",
  rebar: "Structural",
  plywood: "Structural",
  beam: "Structural",
  column: "Structural",
  // Surface Finishes
  glass: "Surface Finishes",
  panel: "Surface Finishes",
  paint: "Surface Finishes",
  coating: "Surface Finishes",
  wallpaper: "Surface Finishes",
  veneer: "Surface Finishes",
};

// Price patterns to try near a product line
const PRICE_PATTERNS = [
  /USD?\s*[\d,]+(?:\.\d+)?(?:\s*[-–\/]\s*[\d,]+(?:\.\d+)?)?/i,
  /\$\s*[\d,]+(?:\.\d+)?(?:\s*[-–\/]\s*[\d,]+(?:\.\d+)?)?/,
  /₹\s*[\d,]+(?:\.\d+)?/,
  /[\d,]+(?:\.\d+)?\s*(?:USD|usd|FOB|fob|\/sqm|\/pc|\/pcs|\/unit)/,
];

// Lead time patterns
const LEAD_PATTERNS = [
  /\d+\s*[-–]?\s*\d*\s*(?:days?|weeks?|months?)/i,
  /(?:lead\s*time|delivery|dispatch|shipping)[:\s]+[\w\s–-]+/i,
];

/** Scan nearby lines within `window` for a price match */
function findPriceNearLine(lines: string[], idx: number, window = 3): string | undefined {
  for (let i = Math.max(0, idx - window); i <= Math.min(lines.length - 1, idx + window); i++) {
    for (const pat of PRICE_PATTERNS) {
      const m = lines[i].match(pat);
      if (m) return m[0].trim();
    }
  }
  return undefined;
}

/** Scan nearby lines within `window` for a lead-time match */
function findLeadTimeNearLine(lines: string[], idx: number, window = 3): string | undefined {
  for (let i = Math.max(0, idx - window); i <= Math.min(lines.length - 1, idx + window); i++) {
    for (const pat of LEAD_PATTERNS) {
      const m = lines[i].match(pat);
      if (m) return m[0].trim();
    }
  }
  return undefined;
}

/** Extract text from a digital PDF using pdf-parse */
async function extractTextWithPdfParse(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    return data.text || "";
  } catch {
    return "";
  }
}

/** Fallback OCR via Tesseract.js for scanned/image PDFs */
async function extractTextWithTesseract(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import so the heavy Tesseract module is only loaded when needed
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const { data } = await worker.recognize(buffer);
    await worker.terminate();
    return data.text || "";
  } catch (err) {
    console.warn("[pdfService] Tesseract OCR failed:", err);
    return "";
  }
}

/**
 * Main entry point: parse a PDF buffer and return product suggestions.
 * Uses pdf-parse for digital PDFs; falls back to Tesseract for scanned ones.
 */
export const parsePdfBuffer = async (buffer: Buffer): Promise<ParsedProductSuggestion[]> => {
  let text = await extractTextWithPdfParse(buffer);

  // If pdf-parse yields < 50 meaningful characters, treat PDF as scanned
  if (text.replace(/\s/g, "").length < 50) {
    console.log("[pdfService] Sparse text — falling back to Tesseract OCR…");
    text = await extractTextWithTesseract(buffer);
  }

  return extractProductCandidates(text);
};

/** Rule-based extraction of product lines from extracted text */
export const extractProductCandidates = (text: string): ParsedProductSuggestion[] => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const suggestions: ParsedProductSuggestion[] = [];
  const seen = new Set<string>();

  // Build a single regex from all category keywords
  const keywordRegex = new RegExp(
    `\\b(${Object.keys(CATEGORY_KEYWORDS).join("|")})\\b`,
    "i"
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Skip very short lines, pure numbers, page numbers, URLs, etc.
    if (lower.length < 10 || lower.split(/\s+/).length < 2) continue;
    if (/^(page\s*\d|www\.|http|email|tel:|fax:|\d+\s*$)/i.test(lower)) continue;
    if (!keywordRegex.test(lower)) continue;

    // Deduplicate by normalised 60-char prefix
    const dedupeKey = lower.replace(/\s+/g, " ").substring(0, 60);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    suggestions.push({
      name: line,
      category: suggestCategory(lower),
      fobPrice: findPriceNearLine(lines, i),
      leadTime: findLeadTimeNearLine(lines, i),
    });
  }

  return suggestions.slice(0, 25);
};

/** Map text to the best matching category using keyword rules */
export const suggestCategory = (text: string): string => {
  const normalized = text.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
    if (normalized.includes(keyword)) return category;
  }
  return "Other";
};
