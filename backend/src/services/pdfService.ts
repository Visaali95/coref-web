import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import zlib from "zlib";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import pdf from "pdf-parse";

export type ParsedProductSuggestion = {
  name: string;
  category: string;
  supplier: string;
  fobPrice: string;
  leadTime: string;
  imageUrl?: string | null;
  /** Raw ML model label e.g. "Office Furniture" (undefined when ML service unavailable) */
  mlLabel?: string;
  /** ML model confidence 0-1 (undefined when ML service unavailable) */
  mlConfidence?: number;
  /** "classified" | "needs_review" | "failed" | "heuristic" */
  mlStatus?: string;
};

// ─── Known product catalogue categories ───────────────────────────────────────
export const PRODUCT_CATEGORIES = [
  "Tiles & Flooring",
  "Sanitaryware",
  "Machinery",
  "Surface Finishes",
  "Structural",
  "Lighting",
  "Other",
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

// ─── Category Keyword Dictionary ──────────────────────────────────────────────
const CATEGORY_KEYWORDS: Record<string, ProductCategory> = {
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

// ─── NodeCanvasFactory for pdfjs-dist v3 ─────────────────────────────────────
/**
 * pdfjs-dist v3 requires a canvas factory to be provided when running in Node.js.
 * This factory uses the `canvas` npm package (libvips-based native module).
 */
interface CanvasAndContext {
  canvas: import("canvas").Canvas;
  context: import("canvas").CanvasRenderingContext2D;
}

function makeNodeCanvasFactory() {
  // Lazy-require canvas so the app still starts if canvas is somehow unavailable
  const { createCanvas } = require("canvas") as typeof import("canvas");

  return {
    create(width: number, height: number): CanvasAndContext {
      const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
      return { canvas, context: canvas.getContext("2d") as import("canvas").CanvasRenderingContext2D };
    },
    reset(cc: CanvasAndContext, width: number, height: number): void {
      cc.canvas.width = Math.ceil(width);
      cc.canvas.height = Math.ceil(height);
    },
    destroy(cc: CanvasAndContext): void {
      cc.canvas.width = 0;
      cc.canvas.height = 0;
      (cc as unknown as Record<string, unknown>).canvas = null;
      (cc as unknown as Record<string, unknown>).context = null;
    },
  };
}

// ─── Visual Image Classifier ──────────────────────────────────────────────────

/**
 * Analyses pixel statistics of an image buffer using `sharp` and returns the
 * most likely product catalogue category.
 *
 * Signals used:
 *   - Dominant hue (HSL) from mean RGB values
 *   - Texture complexity (std-dev across channels)
 *   - Brightness (mean of all channels)
 *   - Aspect ratio
 *
 * Returns null when confidence is low — caller falls back to text keyword matching.
 */
async function classifyImageByPixels(buffer: Buffer): Promise<ProductCategory | null> {
  try {
    const sharp = (await import("sharp")).default;
    const img = sharp(buffer);
    const [meta, stats] = await Promise.all([img.metadata(), img.stats()]);

    const width = meta.width ?? 1;
    const height = meta.height ?? 1;
    const aspectRatio = width / height;

    const rMean = stats.channels[0]?.mean ?? 128;
    const gMean = stats.channels[1]?.mean ?? 128;
    const bMean = stats.channels[2]?.mean ?? 128;
    const brightness = (rMean + gMean + bMean) / 3;

    const maxStdDev = Math.max(
      stats.channels[0]?.stdev ?? 0,
      stats.channels[1]?.stdev ?? 0,
      stats.channels[2]?.stdev ?? 0
    );

    // RGB → Hue (0–360)
    const r = rMean / 255;
    const g = gMean / 255;
    const b = bMean / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let hue = 0;
    if (delta > 0.01) {
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
      if (hue < 0) hue += 360;
    }
    const saturation = max === 0 ? 0 : delta / max;

    // ── Classification rules ─────────────────────────────────────────────────

    // 1. Very bright, low-saturation, low-texture → tiles / flat surfaces
    if (brightness > 190 && saturation < 0.15 && maxStdDev < 40) return "Tiles & Flooring";

    // 2. Very bright, low-saturation, medium-texture → glass / surface finishes
    if (brightness > 190 && saturation < 0.2 && maxStdDev >= 40) return "Surface Finishes";

    // 3. Blue/cyan tones, bright → sanitaryware
    if (hue >= 180 && hue <= 260 && brightness > 140 && saturation > 0.1) return "Sanitaryware";

    // 4. Warm yellow/orange, glowing → lighting
    if ((hue >= 20 && hue <= 60 && saturation > 0.25 && brightness > 150) ||
        (hue >= 0 && hue <= 20 && saturation > 0.2 && brightness > 160)) return "Lighting";

    // 5. Dark image, high texture → machinery / industrial
    if (brightness < 100 && maxStdDev > 35) return "Machinery";

    // 6. Beige / sandy / warm-grey → tiles & flooring (natural stone)
    if (hue >= 20 && hue <= 50 && saturation < 0.35 && brightness >= 100 && brightness <= 210) return "Tiles & Flooring";

    // 7. Wide panoramic, low saturation → flooring / slab
    if (aspectRatio > 1.8 && saturation < 0.25) return "Tiles & Flooring";

    // 8. Tall narrow, bright → pendant / lighting fixture
    if (aspectRatio < 0.55 && brightness > 160) return "Lighting";

    // 9. Green-dominant → structural / natural materials
    if (hue >= 80 && hue <= 160 && saturation > 0.2) return "Structural";

    // 10. Medium brightness, very low saturation, low texture → surface finish panels
    if (brightness >= 100 && brightness <= 200 && saturation < 0.1 && maxStdDev < 30) return "Surface Finishes";

    return null; // Low confidence — let text keyword matching decide
  } catch {
    return null;
  }
}

// ─── PDF Page Renderer ────────────────────────────────────────────────────────

/**
 * Renders EVERY page of the PDF as a JPEG using pdfjs-dist v3 + Node.js canvas.
 *
 * One image is produced per page.  Truly identical pages (same SHA-256) are
 * deduplicated — all other pages, even visually similar ones, are kept so that
 * each product page gets its own unique image in the catalogue.
 *
 * Falls back gracefully to XObject extraction if rendering fails.
 */
async function renderPdfPages(
  buffer: Buffer,
  uploadsDir: string
): Promise<{ url: string; imageBuffer: Buffer }[]> {
  const results: { url: string; imageBuffer: Buffer }[] = [];
  const sha256Seen = new Set<string>();

  try {
    // pdfjs-dist v3 legacy build — CommonJS-compatible
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js") as typeof import("pdfjs-dist");

    // Point the worker at the bundled worker file (avoids "no workerSrc" error)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve("pdfjs-dist/legacy/build/pdf.worker.js");

    const canvasFactory = makeNodeCanvasFactory();

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      // @ts-ignore — pdfjs-dist v3 accepts a custom canvasFactory in Node.js
      canvasFactory,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    console.log(`[pdfService] Rendering ${totalPages} PDF pages…`);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 }); // 1.5× ≈ 1080p quality

        const cc = canvasFactory.create(viewport.width, viewport.height);

        await page.render({
          canvasContext: cc.context as unknown as CanvasRenderingContext2D,
          viewport,
          // @ts-ignore — pdfjs-dist v3 RenderParameters accepts canvasFactory in Node.js
          canvasFactory,
        }).promise;

        const jpegBuffer = (cc.canvas as import("canvas").Canvas).toBuffer("image/jpeg", { quality: 0.88 });

        // ── SHA-256 exact deduplication ──────────────────────────────────────
        // We intentionally skip pHash here: pages that look similar (e.g. white
        // background) should STILL get their own image since they show different
        // products.  Only true byte-for-byte identical pages (e.g. cover repeated
        // at end) are skipped.
        const sha256 = crypto.createHash("sha256").update(jpegBuffer).digest("hex");
        if (sha256Seen.has(sha256)) {
          console.log(`[pdfService] Page ${pageNum}: exact duplicate — skipping`);
          canvasFactory.destroy(cc);
          continue;
        }

        sha256Seen.add(sha256);
        const filename = `pdf-page-${Date.now()}-p${pageNum}.jpg`;
        fs.writeFileSync(path.join(uploadsDir, filename), jpegBuffer);
        results.push({ url: `/uploads/${filename}`, imageBuffer: jpegBuffer });
        console.log(`[pdfService] Page ${pageNum}/${totalPages}: saved → ${filename}`);

        canvasFactory.destroy(cc);
      } catch (pageErr) {
        console.warn(`[pdfService] Page ${pageNum} render error:`, pageErr);
      }
    }

    return results;
  } catch (renderErr) {
    console.warn("[pdfService] Page rendering unavailable, falling back to XObject extraction:", renderErr);
    return legacyExtractXObjects(buffer, uploadsDir);
  }
}

// ─── Legacy XObject Extractor (fallback) ─────────────────────────────────────

/**
 * Extracts embedded JPEG image streams from the PDF's XObject tree.
 * Used as a fallback if page rendering fails.
 * Applies SHA-256 + perceptual-hash deduplication.
 */
async function computeDHash(buffer: Buffer): Promise<bigint | null> {
  try {
    const sharp = (await import("sharp")).default;
    const { data } = await sharp(buffer)
      .resize(9, 8, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let hash = 0n;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        hash = (hash << 1n) | (data[row * 9 + col] > data[row * 9 + col + 1] ? 1n : 0n);
      }
    }
    return hash;
  } catch { return null; }
}

function hammingDistance(a: bigint, b: bigint): number {
  let diff = a ^ b, dist = 0;
  while (diff > 0n) { dist += Number(diff & 1n); diff >>= 1n; }
  return dist;
}

async function legacyExtractXObjects(
  buffer: Buffer,
  uploadsDir: string
): Promise<{ url: string; imageBuffer: Buffer }[]> {
  const results: { url: string; imageBuffer: Buffer }[] = [];
  const sha256Seen = new Set<string>();
  const dHashesSeen: bigint[] = [];

  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    let imgIndex = 0;

    for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      const subtype = obj.dict.get(PDFName.of("Subtype"));
      if (!subtype || subtype.toString() !== "/Image") continue;

      let contents = Buffer.from(obj.contents);
      try { contents = zlib.inflateSync(contents); } catch { /* not FlateDecode */ }

      if (contents.length <= 8000 || contents[0] !== 0xff || contents[1] !== 0xd8) continue;

      const sha256 = crypto.createHash("sha256").update(contents).digest("hex");
      if (sha256Seen.has(sha256)) continue;

      const dHash = await computeDHash(contents);
      if (dHash !== null && dHashesSeen.some((h) => hammingDistance(h, dHash) <= 4)) continue;
      if (dHash !== null) dHashesSeen.push(dHash);

      sha256Seen.add(sha256);
      imgIndex++;
      const filename = `pdf-extract-${Date.now()}-${imgIndex}.jpg`;
      fs.writeFileSync(path.join(uploadsDir, filename), contents);
      results.push({ url: `/uploads/${filename}`, imageBuffer: contents });
    }
  } catch (err) {
    console.warn("[pdfService] XObject extraction warning:", err);
  }

  return results;
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Extracts one image per unique PDF page.  Identical pages (SHA-256 match)
 * are de-duplicated.  Each image is kept even if it looks visually similar
 * to another page so that different products on similar-background pages all
 * get their own image.
 */
export async function extractPdfPageImages(
  buffer: Buffer
): Promise<{ url: string; imageBuffer: Buffer }[]> {
  const uploadsDir = path.join(__dirname, "..", "..", "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  return renderPdfPages(buffer, uploadsDir);
}

// ─── Supplier / Category helpers ──────────────────────────────────────────────

/** Extract supplier name heuristic from filename or header text */
export function extractSupplierName(filename?: string, text?: string): string {
  if (filename) {
    const base = path.basename(filename, path.extname(filename));
    const parts = base.split(/[-_–]/);
    if (parts.length > 0 && parts[0].trim().length >= 2) return parts[0].trim();
  }
  if (text) {
    const firstLines = text.split(/\r?\n/).slice(0, 5).join(" ");
    const match = firstLines.match(/(?:co\.|ltd|inc|group|corp|factory|mfg|industries)/i);
    if (match) {
      const idx = firstLines.indexOf(match[0]);
      return firstLines.substring(Math.max(0, idx - 20), idx + match[0].length).trim();
    }
  }
  return "Supplier Partner";
}

/** Category suggestion based on text keywords */
export function suggestCategory(text: string): ProductCategory {
  const normalized = text.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
    if (normalized.includes(keyword)) return category;
  }
  return "Structural"; // Default category fallback
}

// ─── Text extraction ──────────────────────────────────────────────────────────

async function extractTextFromPdf(buffer: Buffer, extractedImageUrls: string[]): Promise<string> {
  try {
    const data = await pdf(buffer);
    if (data.text && data.text.replace(/\s/g, "").length >= 50) return data.text;
  } catch { /* pdf-parse failed */ }

  console.log("[pdfService] Scanned/image PDF detected — running Tesseract OCR…");
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const textParts: string[] = [];
    const uploadsDir = path.join(__dirname, "..", "..", "uploads");

    for (let i = 0; i < Math.min(12, extractedImageUrls.length); i++) {
      const fullPath = path.join(uploadsDir, extractedImageUrls[i].replace(/^\/uploads\//, ""));
      if (fs.existsSync(fullPath)) {
        const { data } = await worker.recognize(fullPath);
        if (data.text) {
          textParts.push(`--- PAGE ${i + 1} IMAGE: ${extractedImageUrls[i]} ---`);
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

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Main entry point called by the upload route.
 *
 * @param buffer        Raw PDF bytes
 * @param filename      Original filename (for supplier heuristic & logging)
 * @param mlByPage      Optional per-page classification map from the ML service.
 *                      Key = 1-based page number.
 *                      When provided, ML categories replace the pixel heuristic.
 */
export const parsePdfBuffer = async (
  buffer: Buffer,
  filename?: string,
  mlByPage?: Map<number, { category: string; mlLabel: string; confidence: number; mlStatus: string }>
): Promise<ParsedProductSuggestion[]> => {
  const supplier = extractSupplierName(filename);

  // Step 1: One unique rendered image per PDF page
  const extractedImageEntries = await extractPdfPageImages(buffer);
  const extractedImageUrls = extractedImageEntries.map((e) => e.url);

  // Step 2: Build category lookup from ML results (if available), otherwise
  // fall back to the existing pixel-stats heuristic per image.
  let imageCategories: Array<ProductCategory | null> | null = null;
  const imageCategoryMap = new Map<string, ProductCategory | null>();

  if (!mlByPage || mlByPage.size === 0) {
    // Pixel-stats fallback path (ML service unavailable)
    imageCategories = await Promise.all(
      extractedImageEntries.map((e) => classifyImageByPixels(e.imageBuffer))
    );
    extractedImageEntries.forEach((e, i) =>
      imageCategoryMap.set(e.url, imageCategories![i])
    );
  }
  // When mlByPage IS available, we resolve category per suggestion below.

  // Step 3: Extract embedded text (digital PDF or OCR fallback)
  const rawText = await extractTextFromPdf(buffer, extractedImageUrls);

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const suggestions: ParsedProductSuggestion[] = [];
  const seen = new Set<string>();

  let currentImage: string | null = extractedImageUrls[0] ?? null;
  // Track page index (0-based) to correlate with ML page numbers
  let currentPageIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // OCR path: track which page image we're currently on
    const pageMatch = line.match(/--- PAGE (\d+) IMAGE: (\/uploads\/[^\s]+) ---/);
    if (pageMatch) {
      currentPageIndex = Number(pageMatch[1]) - 1; // convert to 0-based
      currentImage = pageMatch[2];
      continue;
    }

    const lower = line.toLowerCase();

    // Filter junk / short / URL / number-only lines
    if (line.length < 4 || line.length > 80) continue;
    if (/^(page\s*\d|www\.|http|email|tel:|fax:|\d+\s*$)/i.test(lower)) continue;

    const key = lower.replace(/[^a-z0-9]/g, "");
    if (key.length < 3 || seen.has(key)) continue;
    seen.add(key);

    // Price search nearby
    let fobPrice = "TBD";
    for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
      for (const pat of PRICE_PATTERNS) {
        const m = lines[j].match(pat);
        if (m) { fobPrice = m[0].trim(); break; }
      }
    }

    // Lead time search nearby
    let leadTime = "4–6 weeks";
    for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
      for (const pat of LEAD_PATTERNS) {
        const m = lines[j].match(pat);
        if (m) { leadTime = m[0].trim(); break; }
      }
    }

    // ── Category resolution ──────────────────────────────────────────────────
    // Priority: ML service (per page) > pixel heuristic (per image) > text keyword
    let category: string;
    let mlLabel: string | undefined;
    let mlConfidence: number | undefined;
    let mlStatus: string | undefined;

    const mlPageNum = currentPageIndex + 1; // ML uses 1-based
    const mlResult = mlByPage?.get(mlPageNum);

    if (mlResult) {
      category = mlResult.category;
      mlLabel = mlResult.mlLabel;
      mlConfidence = mlResult.confidence;
      mlStatus = mlResult.mlStatus;
    } else if (!mlByPage) {
      // Pixel-stats fallback
      const pixelCategory = currentImage ? (imageCategoryMap.get(currentImage) ?? null) : null;
      category = pixelCategory ?? suggestCategory(line + " " + filename);
      mlStatus = "heuristic";
    } else {
      // ML service ran but this page had no classified image → text keyword fallback
      category = suggestCategory(line + " " + filename);
      mlStatus = "heuristic";
    }

    suggestions.push({ name: line, category, supplier, fobPrice, leadTime, imageUrl: currentImage, mlLabel, mlConfidence, mlStatus });
  }

  // Sparse-text fallback: one product entry per unique page image
  if (suggestions.length === 0 && extractedImageEntries.length > 0) {
    const baseName = filename ? path.basename(filename, path.extname(filename)) : "Catalogue Item";
    extractedImageEntries.slice(0, 30).forEach((entry, idx) => {
      const mlPageNum = idx + 1;
      const mlResult = mlByPage?.get(mlPageNum);

      let category: string;
      let mlLabel: string | undefined;
      let mlConfidence: number | undefined;
      let mlStatus: string | undefined;

      if (mlResult) {
        category = mlResult.category;
        mlLabel = mlResult.mlLabel;
        mlConfidence = mlResult.confidence;
        mlStatus = mlResult.mlStatus;
      } else if (!mlByPage) {
        category = (imageCategoryMap.get(entry.url) ?? null) ?? suggestCategory(baseName);
        mlStatus = "heuristic";
      } else {
        category = suggestCategory(baseName);
        mlStatus = "heuristic";
      }

      suggestions.push({
        name: `${baseName} - Page ${idx + 1}`,
        category,
        supplier,
        fobPrice: "$120–$350 / unit",
        leadTime: "4–6 weeks",
        imageUrl: entry.url,
        mlLabel,
        mlConfidence,
        mlStatus,
      });
    });
  }

  return suggestions.slice(0, 30);
};
