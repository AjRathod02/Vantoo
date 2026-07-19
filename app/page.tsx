import { categories } from "@/lib/data/categories";
import { offers } from "@/lib/data/offers";
import { listProducts } from "@/lib/server/products";
import { listRestaurants } from "@/lib/server/restaurants";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ServiceGrid } from "@/components/ServiceGrid";
import { SectionHeader } from "@/components/SectionHeader";
import { RestaurantCard } from "@/components/RestaurantCard";
import { ProductCard } from "@/components/ProductCard";
import { CategoryStrip } from "@/components/CategoryStrip";
import {
  getActiveFlashOffers,
  getSponsoredRestaurants,
  enrichRestaurants,
} from "@/lib/restaurants/promotions";

export default async function HomePage() {
  const [restaurantList, products, sponsored, flashOffers] = await Promise.all([
    listRestaurants(),
    listProducts(),
    getSponsoredRestaurants(),
    getActiveFlashOffers(),
  ]);
  const enriched = await enrichRestaurants(restaurantList.slice(0, 8));

  const popularProducts = products
    .filter((p) => p.service === "food")
    .slice(0, 4);
  const trending = products.filter((p) => p.service === "ecommerce").slice(0, 4);
  const foodCategories = categories.filter((c) => c.service === "food");

  return (
    <div className="container-page space-y-10 py-6">
      <HeroCarousel offers={offers} />

      <section>
        <SectionHeader title="What can we get you?" subtitle="Pick a service to get started" />
        <ServiceGrid />
      </section>

      <section>
        <SectionHeader title="Top Categories" />
        <CategoryStrip categories={foodCategories} />
      </section>

      <section>
        <SectionHeader
          title="Sponsored Restaurants"
          subtitle="Premium partners near you"
          href="/food"
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {(sponsored.length ? sponsored : enriched.filter((r) => r.sponsored)).map(
            (r) => (
              <RestaurantCard key={r.id} restaurant={r} />
            )
          )}
        </div>
      </section>

      {flashOffers.length > 0 && (
        <section>
          <SectionHeader
            title="Limited-Time Offers"
            subtitle="Flash deals ending soon"
          />
          <div className="flex gap-3 overflow-x-auto pb-1">
            {flashOffers.map((o) => (
              <LinkOfferCard key={o.id} offer={o} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeader title="Top Restaurants Near You" href="/food" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {enriched.map((r) => (
            <RestaurantCard key={r.id} restaurant={r} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Popular Near You" href="/food" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {popularProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Trending Products" href="/ecommerce" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {trending.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

function LinkOfferCard({
  offer,
}: {
  offer: Awaited<ReturnType<typeof getActiveFlashOffers>>[number];
}) {
  return (
    <a
      href={`/food?restaurant=${offer.restaurantId}`}
      className="min-w-[220px] shrink-0 rounded-2xl border border-gray-100 bg-gradient-to-br from-brand-surface to-white p-4 shadow-card"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
        {offer.restaurantName}
      </p>
      <p className="mt-1 text-lg font-bold text-ink">{offer.badgeText}</p>
      <p className="mt-1 text-xs text-ink-muted">{offer.subtitle}</p>
      <FlashCountdown endsAt={offer.endsAt} />
    </a>
  );
}

function FlashCountdown({ endsAt }: { endsAt: string }) {
  // Server-rendered static remaining estimate; client RestaurantCard has live timer
  const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return (
    <p className="mt-3 text-xs font-semibold text-brand-secondary">
      Ends in {h > 0 ? `${h}h ` : ""}
      {m}m
    </p>
  );
}
