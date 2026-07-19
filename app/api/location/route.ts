import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/auth";
import {
  deviceToRecord,
  getUserLocation,
  upsertUserLocation,
} from "@/lib/server/userLocations";
import type { LocationRole } from "@/lib/types";
import { clientIpFromRequest, rateLimit } from "@/lib/security/rate-limit";

const bodySchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
  speed: z.number().optional(),
  heading: z.number().optional(),
  altitude: z.number().optional(),
  timestamp: z.string().optional(),
  role: z.enum(["customer", "rider", "vendor", "admin"]).optional(),
  online: z.boolean().optional(),
  orderId: z.string().optional(),
  city: z.string().optional(),
});

function resolveRole(
  requested: LocationRole | undefined,
  sessionRole?: string,
  headerRole?: string | null
): LocationRole {
  // Never trust client-claimed rider/vendor/admin without a matching session role.
  if (sessionRole === "admin") {
    if (requested === "admin" || headerRole === "admin") return "admin";
  }
  // Rider/vendor elevation is handled only when session profile role matches.
  // Customer sessions cannot spoof onto admin location maps.
  if (requested === "rider" || headerRole === "rider") {
    if (sessionRole === "rider") return "rider";
    return "customer";
  }
  if (requested === "vendor" || headerRole === "vendor") {
    if (sessionRole === "vendor") return "vendor";
    return "customer";
  }
  return "customer";
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = await rateLimit({
    key: `location-write:${user.id}:${clientIpFromRequest(request)}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Location updates are temporarily limited." },
      { status: limited.reason === "unavailable" ? 503 : 429 }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const portalRole = request.headers.get("x-vantoo-portal") as LocationRole | null;
  const role = resolveRole(body.role, user.role, portalRole);

  const record = await upsertUserLocation(
    deviceToRecord(
      user.id,
      role,
      {
        latitude: body.latitude,
        longitude: body.longitude,
        accuracy: body.accuracy,
        speed: body.speed,
        heading: body.heading,
        altitude: body.altitude,
        timestamp: body.timestamp ?? new Date().toISOString(),
      },
      {
        name: user.name,
        online: body.online ?? true,
        orderId: body.orderId,
        city: body.city,
      }
    )
  );

  return NextResponse.json({ ok: true, location: record });
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? user.id;

  if (userId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const location = await getUserLocation(userId);
  return NextResponse.json({ location });
}
