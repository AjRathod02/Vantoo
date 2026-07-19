import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { isPlatformEnabled } from "@/lib/platform/client";
import { listProductsPage } from "@/lib/server/products";
import {
  listVendorProducts,
  createVendorProduct,
  publishVendorProduct,
} from "@/lib/platform/vendors";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPlatformEnabled()) {
    const result = await listProductsPage(
      { vendorId: user.id, limit: 50 },
      { cache: false }
    );
    return NextResponse.json(result);
  }

  try {
    const products = await listVendorProducts(user.id);
    return NextResponse.json({ products });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPlatformEnabled()) {
    return NextResponse.json({ error: "Platform mode required" }, { status: 503 });
  }

  const body = await request.json();
  try {
    const product = await createVendorProduct(user.id, body);
    if (body.publish) {
      const published = await publishVendorProduct(user.id, product.platformId!);
      return NextResponse.json({ product: published }, { status: 201 });
    }
    return NextResponse.json({ product }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
