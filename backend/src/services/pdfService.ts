import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import zlib from "zlib";
import fs from "fs";
import path from "path";
import pdf from "pdf-parse";

export type ParsedProductSuggestion = {
  name: string;
  category: string;
  supplier: string;
  fobPrice: string;
  leadTime: string;
  imageUrl?: string | null;
};

// ─── Category Keyword Dictionary ──────────────────────────────────────────────
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
  bidet: "Sanitaryware",
  bathtub: "Sanitaryware",

  // Machinery
  machinery: "Machinery",
  machine: "Machinery",
  cnc: "Machinery",
  molding: "Machinery",
  hydraulic: "Machinery",
  press: "Machinery",
  laser: "Machinery",
  cutter: "Machinery",
  pump: "Machinery",
  motor: "Machinery",
  conveyor: "Machinery",
  equipment: "Machinery",
  compressor: "Machinery",
  generator: "Machinery",
  lathe: "Machinery",

  // Lighting
  lighting: "Lighting",
  light: "Lighting",
  lamp: "Lighting",
  led: "Lighting",
  fixture: "Lighting",
  luminaire: "Lighting",
  chandelier: "Lighting",
  spotlight: "Lighting",
  pendant: "Lighting",

  // Structural
  steel: "Structural",
  concrete: "Structural",
  rebar: "Structural",
  plywood: "Structural",
  beam: "Structural",
  column: "Structural",
  timber: "Structural",
  truss: "Structural",
  desk: "Structural",
  chair: "Structural",
  table: "Structural",
  furniture: "Structural",
  cabinet: "Structural",

  // Surface Finishes
  glass: "Surface Finishes",
  panel: "Surface Finishes",
  paint: "Surface Finishes",
  coating: "Surface Finishes",
  wallpaper: "Surface Finishes",
  veneer: "Surface Finishes",
  cladding: "Surface Finishes",
};

// Price & Lead time regex patterns
const PRICE_PATTERNS = [
  /USD?\s*[\d,]+(?:\.\d+)?(?:\s*[-–\/]\s*[\d,]+(?:\.\d+)?)?/i,
  /\$\s*[\d,]+(?:\.\d+)?(?:\s*[-–\/]\s*[\d,]+(?:\.\d+)?)?/,
  /₹\s*[\d,]+(?:\.\d+)?/,
  /[\d,]+(?:\.\d+)?\s*(?:USD|usd|FOB|fob|\/sqm|\/pc|\/pcs|\/unit)/,
];

const LEAD_PATTERNS = [
  /\d+\s*[-–]?\s*\d*\s*(?:days?|weeks?|months?)/i,
  /(?:lead\s*time|delivery|dispatch|shipping)[:\s]+[\w\s–-]+/i,
];

/** Extract supplier name heuristic from filename or header text */
export function extractSupplierName(filename?: string, text?: string): string {
  if (filename) {
    const base = path.basename(filename, path.extname(filename));
    const parts = base.split(/[-_–]/);
    if (parts.length > 0 && parts[0].trim().length >= 2) {
      return parts[0].trim();
    }
  }
  if (text) {
    const firstLines = text.split(/\r?\n/).slice(0, 5).join(" ");
    const match = firstLines.match(/(?:co\.|ltd|inc|group|corp|factory|mfg|industries)/i);
    if (match) {
      const matchIdx = firstLines.indexOf(match[0]);
      return firstLines.substring(Math.max(0, matchIdx - 20), matchIdx + match[0].length).trim();
    }
  }
  return "Supplier Partner";
}

/** Category suggestion based on text keywords */
export function suggestCategory(text: string): string {
  const normalized = text.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
    if (normalized.includes(keyword)) return category;
  }
  return "Structural"; // Default category fallback
}

/** Extract embedded JPEG images from PDF buffer and save them to disk */
export async function extractPdfPageImages(buffer: Buffer): Promise<string[]> {
  const savedImageUrls: string[] = [];
  const uploadsDir = path.join(__dirname, "..", "..", "uploads");

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const context = pdfDoc.context;
    let imgIndex = 0;

    context.enumerateIndirectObjects().forEach(([, obj]) => {
      if (obj instanceof PDFRawStream) {
        const dict = obj.dict;
        const subtype = dict.get(PDFName.of("Subtype"));
        if (subtype && subtype.toString() === "/Image") {
          let contents = Buffer.from(obj.contents);
          try {
            contents = zlib.inflateSync(contents);
          } catch {
            // Stream was not FlateDecode compressed
          }

          // Filter for valid JPEG header (0xFF 0xD8) and minimum size 8KB
          if (contents.length > 8000 && contents[0] === 0xff && contents[1] === 0xd8) {
            imgIndex++;
            const filename = `pdf-extract-${Date.now()}-${imgIndex}.jpg`;
            const filePath = path.join(uploadsDir, filename);
            fs.writeFileSync(filePath, contents);
            savedImageUrls.push(`/uploads/${filename}`);
          }
        }
      }
    });
  } catch (err) {
    console.warn("[pdfService] Image extraction warning:", err);
  }

  return savedImageUrls;
}

/** Extract text from digital PDF or via Tesseract OCR for image PDF */
async function extractTextFromPdf(buffer: Buffer, extractedImages: string[]): Promise<string> {
  // First try pdf-parse for standard digital text PDFs
  try {
    const data = await pdf(buffer);
    if (data.text && data.text.replace(/\s/g, "").length >= 50) {
      return data.text;
    }
  } catch {
    // pdf-parse failed, fallback to OCR
  }

  // Fallback to Tesseract OCR on extracted images
  console.log("[pdfService] Scanned/image PDF detected — running Tesseract OCR on extracted page images…");
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const textParts: string[] = [];

    const uploadsDir = path.join(__dirname, "..", "..", "uploads");

    // OCR up to the first 12 page images to keep performance snappy
    for (let i = 0; i < Math.min(12, extractedImages.length); i++) {
      const relPath = extractedImages[i].replace(/^\/uploads\//, "");
      const fullPath = path.join(uploadsDir, relPath);
      if (fs.existsSync(fullPath)) {
        const { data } = await worker.recognize(fullPath);
        if (data.text) {
          textParts.push(`--- PAGE ${i + 1} IMAGE: ${extractedImages[i]} ---`);
          textParts.push(data.text);
        }
      }
    }

    await worker.terminate();
    return textParts.join("\n");
  } catch (err) {
    console.warn("[pdfService] OCR fallback failed:", err);
    return "";
  }
}

/** Parse PDF buffer into structured product suggestions */
export const parsePdfBuffer = async (buffer: Buffer, filename?: string): Promise<ParsedProductSuggestion[]> => {
  const supplier = extractSupplierName(filename);
  const extractedImages = await extractPdfPageImages(buffer);
  const rawText = await extractTextFromPdf(buffer, extractedImages);

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const suggestions: ParsedProductSuggestion[] = [];
  const seen = new Set<string>();

  let currentImage: string | null = extractedImages[0] ?? null;
  let pageIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line demarcates a page image
    const pageMatch = line.match(/--- PAGE \d+ IMAGE: (\/uploads\/[^\s]+) ---/);
    if (pageMatch) {
      currentImage = pageMatch[1];
      pageIdx++;
      continue;
    }

    const lower = line.toLowerCase();

    // Filtering out junk / short lines / URLs / numbers
    if (line.length < 4 || line.length > 80) continue;
    if (/^(page\s*\d|www\.|http|email|tel:|fax:|\d+\s*$)/i.test(lower)) continue;

    // Deduplicate
    const key = lower.replace(/[^a-z0-9]/g, "");
    if (key.length < 3 || seen.has(key)) continue;
    seen.add(key);

    // Price search nearby
    let fobPrice = "TBD";
    for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
      for (const pat of PRICE_PATTERNS) {
        const m = lines[j].match(pat);
        if (m) {
          fobPrice = m[0].trim();
          break;
        }
      }
    }

    // Lead time search nearby
    let leadTime = "4–6 weeks";
    for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
      for (const pat of LEAD_PATTERNS) {
        const m = lines[j].match(pat);
        if (m) {
          leadTime = m[0].trim();
          break;
        }
      }
    }

    suggestions.push({
      name: line,
      category: suggestCategory(line + " " + filename),
      supplier,
      fobPrice,
      leadTime,
      imageUrl: currentImage,
    });
  }

  // If no candidates parsed from sparse text, generate fallback items per page image
  if (suggestions.length === 0 && extractedImages.length > 0) {
    const baseName = filename ? path.basename(filename, path.extname(filename)) : "Catalogue Item";
    extractedImages.slice(0, 15).forEach((imgUrl, idx) => {
      suggestions.push({
        name: `${baseName} - Series ${idx + 1}`,
        category: suggestCategory(baseName),
        supplier,
        fobPrice: "$120–$350 / unit",
        leadTime: "4–6 weeks",
        imageUrl: imgUrl,
      });
    });
  }

  return suggestions.slice(0, 30);
};
