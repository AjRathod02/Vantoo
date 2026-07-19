import React, { createContext, useContext, useMemo, useState } from "react";
import type { Product } from "./api";

export type CartLine = {
  product: Product;
  quantity: number;
};

type CartState = {
  lines: CartLine[];
  add: (product: Product, qty?: number) => void;
  setQty: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const value = useMemo<CartState>(() => {
    const add = (product: Product, qty = 1) => {
      setLines((prev) => {
        const existing = prev.find((l) => l.product.id === product.id);
        if (existing) {
          return prev.map((l) =>
            l.product.id === product.id
              ? { ...l, quantity: l.quantity + qty }
              : l
          );
        }
        return [...prev, { product, quantity: qty }];
      });
    };
    const setQty = (productId: string, quantity: number) => {
      setLines((prev) =>
        quantity <= 0
          ? prev.filter((l) => l.product.id !== productId)
          : prev.map((l) =>
              l.product.id === productId ? { ...l, quantity } : l
            )
      );
    };
    const remove = (productId: string) =>
      setLines((prev) => prev.filter((l) => l.product.id !== productId));
    const clear = () => setLines([]);
    const count = lines.reduce((s, l) => s + l.quantity, 0);
    const subtotal = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
    return { lines, add, setQty, remove, clear, count, subtotal };
  }, [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
