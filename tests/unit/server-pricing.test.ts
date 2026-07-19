import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  inCalls: 0,
}));

vi.mock("@/utils/supabase/admin", () => ({
  hasAdminClient: () => true,
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        in: async () => {
          state.inCalls += 1;
          return { data: state.rows, error: null };
        },
      }),
    }),
  }),
}));

import { priceOrderItems } from "@/lib/payments/server-pricing";

describe("priceOrderItems", () => {
  beforeEach(() => {
    state.inCalls = 0;
    state.rows = [
      {
        id: "p1",
        name: "Rice",
        image: "rice.jpg",
        images: [],
        price: 100,
        in_stock: true,
      },
      {
        id: "p2",
        name: "Milk",
        image: "milk.jpg",
        images: [],
        price: 50,
        in_stock: true,
      },
    ];
  });

  it("deduplicates product IDs and prices with one database query", async () => {
    const result = await priceOrderItems([
      { productId: "p1", quantity: 1 },
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 1 },
    ]);

    expect(state.inCalls).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({ productId: "p1", quantity: 3, price: 100 }),
      expect.objectContaining({ productId: "p2", quantity: 1, price: 50 }),
    ]);
    expect(result.subtotal).toBe(350);
    expect(result.tax).toBe(18);
    expect(result.deliveryFee).toBe(40);
    expect(result.total).toBe(408);
  });

  it("fails closed when any requested product is missing", async () => {
    state.rows = state.rows.slice(0, 1);
    await expect(
      priceOrderItems([
        { productId: "p1", quantity: 1 },
        { productId: "missing", quantity: 1 },
      ])
    ).rejects.toThrow("unavailable");
  });

  it("rejects unsupported variants instead of mispricing them", async () => {
    await expect(
      priceOrderItems([{ productId: "p1", variantId: "v1", quantity: 1 }])
    ).rejects.toThrow("variants");
    expect(state.inCalls).toBe(0);
  });
});
