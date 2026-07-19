import { NextResponse } from "next/server";
import { listProductsPage } from "@/lib/server/products";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const service = searchParams.get("service") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const brands = searchParams.get("brands")?.split(",").filter(Boolean);
  const numberParam = (name: string) => {
    const value = searchParams.get(name);
    if (value == null || value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const result = await listProductsPage({
    service,
    category,
    q,
    brands,
    minPrice: numberParam("minPrice"),
    maxPrice: numberParam("maxPrice"),
    minRating: numberParam("minRating"),
    sort: searchParams.get("sort") ?? undefined,
    page: numberParam("page"),
    limit: numberParam("limit"),
  });

  return NextResponse.json(result);
}
