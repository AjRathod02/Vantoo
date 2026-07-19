import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { listProductsPage, upsertProduct } from "@/lib/server/products";
import type { Product } from "@/lib/types";
import { z } from "zod";

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  service: z.enum(["food", "grocery", "medicine", "ecommerce"]),
  category: z.string(),
  brand: z.string(),
  price: z.number(),
  originalPrice: z.number().optional(),
  rating: z.number(),
  reviews: z.number(),
  image: z.string(),
  images: z.array(z.string()).optional(),
  videos: z.array(z.string()).optional(),
  thumbnailIndex: z.number().optional(),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  vendorId: z.string().optional(),
  unit: z.string().optional(),
  inStock: z.boolean(),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 50;
    const result = await listProductsPage(
      { page, limit, q: searchParams.get("q") ?? undefined },
      { cache: false }
    );
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Forbidden";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid product" }, { status: 400 });
    }
    const product = await upsertProduct(parsed.data as Product);
    return NextResponse.json({ product }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Forbidden";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const status = message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
