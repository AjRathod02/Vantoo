import { getSessionUser } from "@/lib/server/auth";
import {
  listUserLocations,
  loadLocationsFromDb,
} from "@/lib/server/userLocations";
import {
  subscribeAdminLocations,
  subscribeUserLocation,
} from "@/lib/tracking/broadcaster";
import type { LocationRole, UserLocationRecord } from "@/lib/types";
import { clientIpFromRequest, rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const limited = await rateLimit({
    key: `location-sse:${user.id}:${clientIpFromRequest(request)}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return new Response("Location stream temporarily limited", {
      status: limited.reason === "unavailable" ? 503 : 429,
    });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const userId = searchParams.get("userId");
  const role = searchParams.get("role") as LocationRole | null;
  const city = searchParams.get("city");
  const online = searchParams.get("online");

  if (scope === "admin" && user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  await loadLocationsFromDb();

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (record: UserLocationRecord) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(record)}\n\n`)
        );
      };

      const initial = listUserLocations({
        role: role ?? undefined,
        city: city ?? undefined,
        online:
          online === "true" ? true : online === "false" ? false : undefined,
      });

      if (scope === "admin") {
        initial.forEach(send);
        unsubscribe = await subscribeAdminLocations((record) => {
          if (role && record.role !== role) return;
          if (city && record.city !== city) return;
          send(record);
        });
      } else if (userId) {
        if (userId !== user.id && user.role !== "admin") {
          controller.close();
          return;
        }
        const existing = initial.find((r) => r.userId === userId);
        if (existing) send(existing);
        unsubscribe = await subscribeUserLocation(userId, send);
      } else {
        const mine = initial.find((r) => r.userId === user.id);
        if (mine) send(mine);
        unsubscribe = await subscribeUserLocation(user.id, send);
      }

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
