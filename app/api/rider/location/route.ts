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
  orderId: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  speed: z.number().optional(),
  heading: z.number().optional(),
  timestamp: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "rider" && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const limited = await rateLimit({
    key: `rider-gps:${user.id}:${clientIpFromRequest(request)}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Rider location updates are temporarily limited." },
      { status: limited.reason === "unavailable" ? 503 : 429 }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const lat = body.lat ?? body.latitude;
  const lng = body.lng ?? body.longitude;

  if (lat == null || lng == null) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  if (body.orderId) {
    const order = await getOrder(body.orderId);
    if (order) {
      const customer = {
        lat: order.tracking?.customerLat ?? lat,
        lng: order.tracking?.customerLng ?? lng,
      };
      const rider = { lat, lng };
      const distanceKm = haversineKm(rider, customer);
      const speed = body.speed ?? 25;

      const payload = {
        lat,
        lng,
        speed,
        heading: body.heading ?? bearingDegrees(rider, customer),
        timestamp: body.timestamp ?? new Date().toISOString(),
        distanceKm: Number(distanceKm.toFixed(2)),
        distanceRemainingM: Math.round(distanceKm * 1000),
        etaMinutes: estimateEtaMinutes(distanceKm, speed),
        riderName: order.tracking?.riderName,
        riderPhone: order.tracking?.riderPhone,
        riderRating: order.tracking?.riderRating,
      };

      await updateOrderTracking(body.orderId, {
        riderLat: lat,
        riderLng: lng,
        riderSpeed: payload.speed,
        riderHeading: payload.heading,
        distanceKm: payload.distanceKm,
        distanceRemainingM: payload.distanceRemainingM,
        etaMinutes: payload.etaMinutes,
        updatedAt: payload.timestamp,
      }, user.id);
    }
  }

  return NextResponse.json({ ok: true });
}
