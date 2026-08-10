import express from "express";
import cors from "cors";
import path from "path";
import productsRouter from "./routes/products";
import enquiriesRouter from "./routes/enquiries";
import uploadRouter from "./routes/upload";

const app = express();
app.use(cors());
app.use(express.json());

// ─── Static file serving for uploaded images ──────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(UPLOADS_DIR));

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api/products", productsRouter);
app.use("/api/enquiries", enquiriesRouter);
app.use("/api/upload", uploadRouter);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Coref backend listening on http://localhost:${port}`);
});
