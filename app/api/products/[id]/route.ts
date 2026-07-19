import { NextResponse } from "next/server";
import { getProduct, listProducts } from "@/lib/server/products";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const product = await getProduct(params.id);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  const related = (await listProducts({ service: product.service, limit: 6 }))
    .filter((p) => p.id !== product.id)
    .slice(0, 5);
  return NextResponse.json({ product, related });
}
