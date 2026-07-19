import { DELIVERY_FEE, TAX_RATE } from "@/lib/commerce/constants";
import type { Order } from "@/lib/types";
import { createAdminClient, hasAdminClient } from "@/utils/supabase/admin";

export type PricedOrderItem = Order["items"][number];

type PricingRow = {
  id: string;
  name: string;
  image: string;
  images: unknown;
  price: number;
  in_stock: boolean;
};

const MAX_CART_LINES = 100;
const MAX_QUANTITY_PER_LINE = 100;
const MAX_CART_UNITS = 500;

export async function priceOrderItems(
  items: Array<{ productId: string; quantity: number; variantId?: string }>,
  opts?: { discount?: number }
): Promise<{
  items: PricedOrderItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  discount: number;
  total: number;
}> {
  if (!items.length) throw new Error("Cart is empty");
  if (items.length > MAX_CART_LINES) throw new Error("Cart has too many lines");
  if (!hasAdminClient()) throw new Error("Catalog database is not configured");

  const quantities = new Map<string, number>();
  for (const item of items) {
    const quantity = Math.floor(Number(item.quantity));
    if (
      !item.productId ||
      !Number.isFinite(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY_PER_LINE
    ) {
      throw new Error("Invalid cart item");
    }
    if (item.variantId) {
      throw new Error("Product variants are not available in this catalog");
    }
    quantities.set(
      item.productId,
      (quantities.get(item.productId) ?? 0) + quantity
    );
  }

  const totalUnits = [...quantities.values()].reduce(
    (sum, quantity) => sum + quantity,
    0
  );
  if (totalUnits > MAX_CART_UNITS) throw new Error("Cart quantity is too large");

  const supabase = createAdminClient();
  const productIds = [...quantities.keys()];
  const { data, error } = await supabase
    .from("products")
    .select("id,name,image,images,price,in_stock")
    .in("id", productIds);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as PricingRow[];
  if (rows.length !== productIds.length) {
    throw new Error("One or more products are unavailable");
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  const priced = productIds.map((productId) => {
    const product = byId.get(productId);
    if (!product || !product.in_stock) {
      throw new Error("One or more products are out of stock");
    }
    const images = Array.isArray(product.images)
      ? product.images.filter((value): value is string => typeof value === "string")
      : [];
    return {
      productId,
      name: product.name,
      image: images[0] || product.image,
      price: Number(product.price),
      quantity: quantities.get(productId)!,
    };
  });

  const subtotal = priced.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const discount = Math.max(
    0,
    Math.min(Math.round(opts?.discount ?? 0), Math.round(subtotal))
  );
  const taxable = Math.max(subtotal - discount, 0);
  const tax = Math.round(taxable * TAX_RATE);
  const deliveryFee = subtotal > 0 ? DELIVERY_FEE : 0;
  const total = taxable + tax + deliveryFee;

  return { items: priced, subtotal, deliveryFee, tax, discount, total };
}
