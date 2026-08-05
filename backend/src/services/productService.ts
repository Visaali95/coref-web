import { prisma } from "../lib/db";
import type { Product } from "@prisma/client";

export const getProducts = async () => {
  return prisma.product.findMany({ orderBy: { updatedAt: "desc" } });
};

/** Returns only products with status = "Published" — used by the public-facing API */
export const getPublishedProducts = async () => {
  return prisma.product.findMany({
    where: { status: "Published" },
    orderBy: { updatedAt: "desc" },
  });
};

export const getProductById = async (id: number) => {
  return prisma.product.findUnique({ where: { id } });
};

export const createProduct = async (data: Omit<Product, "id" | "createdAt" | "updatedAt">) => {
  return prisma.product.create({ data });
};

export const updateProduct = async (id: number, data: Partial<Omit<Product, "id" | "createdAt" | "updatedAt">>) => {
  return prisma.product.update({ where: { id }, data });
};

/** Convenience update for changing only the status field */
export const updateProductStatus = async (id: number, status: string) => {
  return prisma.product.update({ where: { id }, data: { status } });
};

export const deleteProduct = async (id: number) => {
  return prisma.product.delete({ where: { id } });
};
