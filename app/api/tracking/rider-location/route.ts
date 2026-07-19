import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/auth";
import { getOrder, updateOrderTracking } from "@/lib/server/orders";
import { clientIpFromRequest, rateLimit } from "@/lib/security/rate-limit";
import {
  bearingDegrees,
  estimateEtaMinutes,
  haversineKm,
} from "@/lib/tracking/geo";

const bodySchema = z.object({
  orderId: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  speed: z.number().optional(),
  heading: z.number().optional(),
  timestamp: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = await rateLimit({
    key: `admin-tracking:${user.id}:${clientIpFromRequest(request)}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Tracking updates are temporarily limited." },
      { status: limited.reason === "unavailable" ? 503 : 429 }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const order = await getOrder(body.orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Only admins (or assigned riders via /api/rider/location) may update rider GPS.
  // Customers must not spoof delivery location on their own orders.
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const customer = {
    lat: order.tracking?.customerLat ?? body.lat,
    lng: order.tracking?.customerLng ?? body.lng,
  };
  const rider = { lat: body.lat, lng: body.lng };
  const distanceKm = haversineKm(rider, customer);
  const speed = body.speed ?? 25;
  const heading = body.heading ?? bearingDegrees(rider, customer);

  const payload = {
    lat: body.lat,
    lng: body.lng,
    speed,
    heading,
    timestamp: body.timestamp ?? new Date().toISOString(),
    distanceKm: Number(distanceKm.toFixed(2)),
    distanceRemainingM: Math.round(distanceKm * 1000),
    etaMinutes: estimateEtaMinutes(distanceKm, speed),
    riderName: order.tracking?.riderName,
    riderPhone: order.tracking?.riderPhone,
    riderRating: order.tracking?.riderRating,
  };

  await updateOrderTracking(body.orderId, {
    riderLat: payload.lat,
    riderLng: payload.lng,
    riderSpeed: payload.speed,
    riderHeading: payload.heading,
    distanceKm: payload.distanceKm,
    distanceRemainingM: payload.distanceRemainingM,
    etaMinutes: payload.etaMinutes,
    updatedAt: payload.timestamp,
  }, user.id, "admin");

  return NextResponse.json({ ok: true, tracking: payload });
}
