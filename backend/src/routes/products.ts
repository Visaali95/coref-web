import { Router } from "express";
import { z } from "zod";
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  getPublishedProducts,
  updateProduct,
  updateProductStatus,
} from "../services/productService";

const router = Router();

const productSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  supplier: z.string().min(1),
  fobPrice: z.string().min(1),
  leadTime: z.string().optional(),
  imageUrl: z.string().optional(),
  status: z.string().min(1),
});

const statusSchema = z.object({
  status: z.enum(["Draft", "Published", "Needs Review"]),
});

// ─── Public endpoint: only Published products ─────────────────────────────────
router.get("/published", async (req, res) => {
  const products = await getPublishedProducts();
  res.json(products);
});

// ─── Admin endpoints (all products regardless of status) ──────────────────────
router.get("/", async (req, res) => {
  const products = await getProducts();
  res.json(products);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const product = await getProductById(id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
});

router.post("/", async (req, res) => {
  const result = productSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.format() });
  const { leadTime, imageUrl, ...rest } = result.data;
  const product = await createProduct({ ...rest, leadTime: leadTime ?? null, imageUrl: imageUrl ?? null });
  res.status(201).json(product);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const result = productSchema.partial().safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.format() });
  try {
    const product = await updateProduct(id, result.data);
    res.json(product);
  } catch {
    res.status(404).json({ message: "Product not found" });
  }
});

// ─── Quick status-only update ─────────────────────────────────────────────────
router.patch("/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const result = statusSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.format() });
  try {
    const product = await updateProductStatus(id, result.data.status);
    res.json(product);
  } catch {
    res.status(404).json({ message: "Product not found" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await deleteProduct(id);
    res.status(204).send();
  } catch {
    res.status(404).json({ message: "Product not found" });
  }
});

export default router;
