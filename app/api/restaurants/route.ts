import { NextResponse } from "next/server";
import { listRestaurants } from "@/lib/server/restaurants";

export async function GET() {
  const restaurants = await listRestaurants();
  return NextResponse.json({ restaurants });
}
