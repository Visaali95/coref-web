import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parsePdfBuffer } from "../services/pdfService";

const router = Router();

// ─── PDF upload (memory storage, passed to pdfService) ────────────────────────
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post("/pdf", pdfUpload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: "PDF file is required" });

  try {
    const suggestions = await parsePdfBuffer(file.buffer);
    res.json({ suggestions });
  } catch (error) {
    console.error(error);
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

export default router;
