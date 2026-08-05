import express from "express";
import cors from "cors";
import productsRouter from "./routes/products";
import enquiriesRouter from "./routes/enquiries";
import uploadRouter from "./routes/upload";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/products", productsRouter);
app.use("/api/enquiries", enquiriesRouter);
app.use("/api/upload", uploadRouter);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Coref backend listening on http://localhost:${port}`);
});

