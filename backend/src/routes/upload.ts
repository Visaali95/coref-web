import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parsePdfBuffer } from "../services/pdfService";
import { classifyPdfWithMLService } from "../services/classifierService";

const router = Router();

// ─── PDF upload (memory storage, passed to pdfService + ML classifier) ────────
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post("/pdf", pdfUpload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: "PDF file is required" });

  try {
    // ── Step 1: Call the ML classifier service (runs in parallel with page rendering) ──
    // classifyPdfWithMLService never throws — it returns { status: "unavailable" }
    // on connection errors so the rest of the pipeline degrades gracefully.
    const mlResult = await classifyPdfWithMLService(file.buffer, file.originalname);

    // Build a per-page classification map for parsePdfBuffer.
    // undefined = ML service was unavailable → pixel heuristic will be used instead.
    const mlByPage =
      mlResult.status === "ok"
        ? mlResult.byPage
        : undefined;

    if (mlResult.status !== "ok") {
      console.warn(
        `[upload/pdf] ML service ${mlResult.status}: ${mlResult.reason}. ` +
          "Using pixel-stats heuristic classifier as fallback."
      );
    }

    // ── Step 2: Extract images + assign categories ──────────────────────────
    const suggestions = await parsePdfBuffer(file.buffer, file.originalname, mlByPage);

    // ── Step 3: Attach classifier provenance info to the response ───────────
    res.json({
      suggestions,
      classifierUsed: mlResult.status === "ok" ? "ml" : "heuristic",
      ...(mlResult.status === "ok" && {
        mlSummary: mlResult.summary,
      }),
    });
  } catch (error) {
    console.error("[upload/pdf] Unhandled error:", error);
    res.status(500).json({ message: "Failed to parse PDF" });
  }
});

// ─── Image upload (disk storage, served as static files) ──────────────────────
const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");

// Ensure the uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${unique}${ext}`);
  },
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max per image
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WEBP, and GIF images are allowed"));
    }
  },
});

router.post("/image", imageUpload.single("image"), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: "Image file is required" });

  // Return the URL path that the frontend can use to display the image
  const imageUrl = `/uploads/${file.filename}`;
  res.json({ imageUrl });
});

// ─── General Document Upload (PDF, Images, CAD/DWG, Excel, Word, ZIP, etc.) ────

const documentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase() || "";
    cb(null, `doc-${unique}${ext}`);
  },
});

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg",
  ".xls", ".xlsx", ".csv", ".doc", ".docx", ".dwg", ".dxf", ".zip", ".txt"
]);

const documentUpload = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type '${ext}' is not allowed. Please upload PDF, Image, Excel, Word, DWG, or ZIP files.`));
    }
  },
});

router.post("/document", documentUpload.single("file"), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: "No file uploaded" });

  const url = `/uploads/${file.filename}`;
  res.json({
    url,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  });
});

router.post("/documents", documentUpload.array("files", 10), (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) return res.status(400).json({ message: "No files uploaded" });

  const uploaded = files.map((file) => ({
    url: `/uploads/${file.filename}`,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  }));

  res.json({ files: uploaded });
});

export default router;

