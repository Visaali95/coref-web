import { Router } from "express";
import { z } from "zod";
import { getEnquiryById, getEnquiries, updateEnquiryStatus, createEnquiry } from "../services/enquiryService";

const router = Router();

const enquiryStatusSchema = z.object({ status: z.string().min(1) });

const enquiryCreateSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1),
  role: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  items: z.string().min(1),
  message: z.string().min(1),
  attachments: z.string().optional(),
});

router.get("/", async (req, res) => {
  const enquiries = await getEnquiries();
  res.json(enquiries);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const enquiry = await getEnquiryById(id);
  if (!enquiry) return res.status(404).json({ message: "Enquiry not found" });
  res.json(enquiry);
});

router.post("/", async (req, res) => {
  const result = enquiryCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.format() });

  // Auto-generate a reference: ENQ-YYYYMMDD-XXXX
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const reference = `ENQ-${dateStr}-${suffix}`;

  try {
    const { email, phone, attachments, ...rest } = result.data;
    const enquiry = await createEnquiry({
      ...rest,
      reference,
      status: "New",
      email: email ?? null,
      phone: phone ?? null,
      attachments: attachments ?? null,
    });
    res.status(201).json(enquiry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create enquiry" });
  }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const result = enquiryStatusSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.format() });
  try {
    const enquiry = await updateEnquiryStatus(id, result.data.status);
    res.json(enquiry);
  } catch (error) {
    res.status(404).json({ message: "Enquiry not found" });
  }
});

export default router;
