import { prisma } from "../lib/db";
import type { Enquiry } from "@prisma/client";

export const getEnquiries = async () => {
  return prisma.enquiry.findMany({ orderBy: { submittedAt: "desc" } });
};

export const getEnquiryById = async (id: number) => {
  return prisma.enquiry.findUnique({ where: { id } });
};

export const createEnquiry = async (
  data: Omit<Enquiry, "id" | "submittedAt">
) => {
  return prisma.enquiry.create({ data });
};

export const updateEnquiryStatus = async (id: number, status: string) => {
  return prisma.enquiry.update({ where: { id }, data: { status } });
};
