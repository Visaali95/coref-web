import { Router } from "express";
import multer from "multer";
import { parsePdfBuffer } from "../services/pdfService";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post("/pdf", upload.single("file"), async (req, res) => {
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

export default router;
