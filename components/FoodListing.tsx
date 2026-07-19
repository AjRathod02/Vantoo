"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Product, Restaurant } from "@/lib/types";
import { api } from "@/lib/api";
import { Chip } from "@/components/ui/Chip";
import { ProductGrid, ProductGridSkeleton } from "@/components/ProductGrid";
import { RestaurantCard } from "@/components/RestaurantCard";
import { SectionHeader } from "@/components/SectionHeader";

export function FoodListing() {
  const searchParams = useSearchParams();
  const restaurantFilter = searchParams.get("restaurant");
  const [category, setCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.restaurants().then((d) => setRestaurants(d.restaurants));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .products({ service: "food" })
      .then((data) => {
        if (!active) return;
        setProducts(data.products);
      })
      .catch(() => active && setProducts([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setCategory(null);
  }, [restaurantFilter]);

  const activeRestaurant = restaurants.find((r) => r.id === restaurantFilter);
  const restaurantProducts = restaurantFilter
    ? products.filter((p) => p.vendorId === restaurantFilter)
    : products;
  const categories = Array.from(
    new Set(restaurantProducts.map((product) => product.category).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const visibleProducts = category
    ? restaurantProducts.filter((product) => product.category === category)
    : restaurantProducts;

  return (
    <div className="container-page space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          {activeRestaurant ? activeRestaurant.name : "Food Delivery"}
        </h1>
        <p className="text-sm text-ink-muted">
          {activeRestaurant
            ? activeRestaurant.cuisine.join(", ")
            : "Order from the best restaurants near you"}
        </p>
      </div>

      {!restaurantFilter && (
        <section>
          <SectionHeader title="Restaurants" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {restaurants.map((r) => (
              <RestaurantCard key={r.id} restaurant={r} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <SectionHeader title="Dishes" />
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          <Chip active={!category} onClick={() => setCategory(null)}>
            All
          </Chip>
          {categories.map((categoryName) => (
            <Chip
              key={categoryName}
              active={category === categoryName}
              onClick={() => setCategory(categoryName)}
            >
              {categoryName}
            </Chip>
          ))}
        </div>

        {loading ? (
          <ProductGridSkeleton />
        ) : visibleProducts.length > 0 ? (
          <ProductGrid products={visibleProducts} />
        ) : (
          <p className="py-16 text-center text-ink-muted">
            No dishes found for this selection.
          </p>
        )}
      </section>
    </div>
  );
}
