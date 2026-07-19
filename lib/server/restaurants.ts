import { restaurants as seedRestaurants } from "@/lib/data/restaurants";
import type { Restaurant } from "@/lib/types";
import { createAdminClient, hasAdminClient } from "@/utils/supabase/admin";

type DbRestaurant = {
  id: string;
  name: string;
  cuisine: string[] | null;
  rating: number;
  reviews: number;
  delivery_time: string;
  price_for_two: number;
  image: string;
  offer: string | null;
  promoted: boolean;
};

function rowToRestaurant(row: DbRestaurant): Restaurant {
  return {
    id: row.id,
    name: row.name,
    cuisine: row.cuisine ?? [],
    rating: Number(row.rating),
    reviews: row.reviews,
    deliveryTime: row.delivery_time,
    priceForTwo: Number(row.price_for_two),
    image: row.image,
    offer: row.offer ?? undefined,
    promoted: row.promoted,
  };
}

export async function listRestaurants(): Promise<Restaurant[]> {
  if (hasAdminClient()) {
    try {
      const { data, error } = await createAdminClient()
        .from("restaurants")
        .select(
          "id, name, cuisine, rating, reviews, delivery_time, price_for_two, image, offer, promoted"
        )
        .eq("is_active", true)
        .order("name");

      if (!error && data?.length) {
        return (data as DbRestaurant[]).map(rowToRestaurant);
      }
    } catch (error) {
      console.error("listRestaurants:", error);
    }
  }

  return seedRestaurants;
}
