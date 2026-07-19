"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import type { Restaurant } from "@/lib/types";
import type { FlashOffer } from "@/lib/restaurants/promotions";
import { formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

function useCountdown(endsAt?: string) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const ms = new Date(endsAt).getTime() - Date.now();
      if (ms <= 0) {
        setLeft("Ended");
        return;
      }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(
        h > 0
          ? `${h}h ${String(m).padStart(2, "0")}m`
          : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return left;
}

export function RestaurantCard({
  restaurant,
}: {
  restaurant: Restaurant & { sponsored?: boolean; flashOffer?: FlashOffer };
}) {
  const countdown = useCountdown(restaurant.flashOffer?.endsAt);

  return (
    <Link
      href={`/food?restaurant=${restaurant.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card transition-shadow hover:shadow-cardHover"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
        <Image
          src={restaurant.image}
          alt={restaurant.name}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {(restaurant.offer || restaurant.flashOffer) && (
          <span className="absolute bottom-2 left-2 rounded-lg bg-brand-secondary px-2 py-0.5 text-xs font-bold text-white">
            {restaurant.flashOffer?.badgeText ?? restaurant.offer}
          </span>
        )}
        {restaurant.sponsored && (
          <span className="absolute left-2 top-2 rounded-lg bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Sponsored
          </span>
        )}
        {!restaurant.sponsored && restaurant.promoted && (
          <span className="absolute left-2 top-2 rounded-lg bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Promoted
          </span>
        )}
        {restaurant.flashOffer && countdown && (
          <span className="absolute right-2 top-2 rounded-lg bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
            {countdown}
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold text-ink">
            {restaurant.name}
          </h3>
          <Badge tone="green">
            {restaurant.rating > 0 ? restaurant.rating.toFixed(1) : "New"}
          </Badge>
        </div>
        <p className="line-clamp-1 text-xs text-ink-soft">
          {restaurant.cuisine.join(", ")}
        </p>
        {(restaurant.deliveryTime || restaurant.priceForTwo > 0) && (
          <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
            {restaurant.deliveryTime && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {restaurant.deliveryTime}
              </span>
            )}
            {restaurant.priceForTwo > 0 && (
              <span>{formatINR(restaurant.priceForTwo)} for two</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
