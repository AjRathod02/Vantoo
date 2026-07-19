import type { DeviceLocation, LocationRole, UserLocationRecord } from "@/lib/types";
import { publishUserLocation } from "@/lib/tracking/broadcaster";
import { hasAdminClient, createAdminClient } from "@/utils/supabase/admin";
import { getRedisCommand, redisKey } from "@/lib/redis/client";

const globalForLocations = globalThis as unknown as {
  vantooUserLocations?: Map<string, UserLocationRecord>;
};

const locations =
  globalForLocations.vantooUserLocations ?? new Map<string, UserLocationRecord>();

if (process.env.NODE_ENV !== "production") {
  globalForLocations.vantooUserLocations = locations;
}

const STALE_MS = 5 * 60 * 1000;

export async function upsertUserLocation(
  record: Omit<UserLocationRecord, "updatedAt"> & { updatedAt?: string }
): Promise<UserLocationRecord> {
  const updated: UserLocationRecord = {
    ...record,
    online: record.online ?? true,
    updatedAt: record.updatedAt ?? new Date().toISOString(),
  };

  if (!hasAdminClient()) throw new Error("Location database is not configured");
  await persistLocation(updated);
  locations.set(record.userId, updated);
  const redis = getRedisCommand();
  if (redis) {
    await redis.set(
      redisKey("tracking-state", "user", updated.userId),
      JSON.stringify(updated),
      "EX",
      300
    );
  }
  await publishUserLocation(updated);

  return updated;
}

async function persistLocation(record: UserLocationRecord) {
  const supabase = createAdminClient();
  const { error: locationError } = await supabase.from("user_locations").upsert({
    user_id: record.userId,
    role: record.role,
    latitude: record.latitude,
    longitude: record.longitude,
    accuracy: record.accuracy ?? null,
    speed: record.speed ?? null,
    heading: record.heading ?? null,
    altitude: record.altitude ?? null,
    online: record.online ?? true,
    order_id: record.orderId ?? null,
    city: record.city ?? null,
    updated_at: record.updatedAt,
  });
  if (locationError) throw new Error(locationError.message);

  if (record.orderId) {
    const { error: historyError } = await supabase.from("user_location_history").insert({
      user_id: record.userId,
      role: record.role,
      latitude: record.latitude,
      longitude: record.longitude,
      accuracy: record.accuracy ?? null,
      speed: record.speed ?? null,
      heading: record.heading ?? null,
      order_id: record.orderId,
      recorded_at: record.updatedAt,
    });
    if (historyError) throw new Error(historyError.message);
    const { error: trackingError } = await supabase.rpc("persist_order_tracking", {
      p_order_id: record.orderId,
      p_rider_id: record.userId,
      p_latitude: record.latitude,
      p_longitude: record.longitude,
      p_accuracy: record.accuracy ?? null,
      p_speed: record.speed ?? null,
      p_heading: record.heading ?? null,
      p_source: "location_api",
      p_metadata: { role: record.role, city: record.city },
    });
    if (trackingError) throw new Error(trackingError.message);
  }
}

export async function getUserLocation(userId: string): Promise<UserLocationRecord | null> {
  if (hasAdminClient()) {
    const { data, error } = await createAdminClient()
      .from("user_locations")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      locations.set(userId, rowToLocation(data));
    }
  }
  const record = locations.get(userId);
  if (!record) return null;
  if (Date.now() - new Date(record.updatedAt).getTime() > STALE_MS) {
    return { ...record, online: false };
  }
  return record;
}

export function listUserLocations(filters?: {
  role?: LocationRole;
  online?: boolean;
  orderId?: string;
  city?: string;
}): UserLocationRecord[] {
  const now = Date.now();
  return Array.from(locations.values())
    .filter((r) => {
      if (filters?.role && r.role !== filters.role) return false;
      if (filters?.city && r.city !== filters.city) return false;
      if (filters?.orderId && r.orderId !== filters.orderId) return false;
      const isOnline =
        r.online !== false &&
        now - new Date(r.updatedAt).getTime() <= STALE_MS;
      if (filters?.online === true && !isOnline) return false;
      if (filters?.online === false && isOnline) return false;
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

export async function loadLocationsFromDb(): Promise<void> {
  if (!hasAdminClient()) throw new Error("Location database is not configured");
  const supabase = createAdminClient();
  const { data, error } = await supabase
      .from("user_locations")
      .select("*")
      .gte(
        "updated_at",
        new Date(Date.now() - STALE_MS).toISOString()
      );
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    locations.set(row.user_id, rowToLocation(row));
  }
}

function rowToLocation(row: Record<string, unknown>): UserLocationRecord {
  return {
    userId: String(row.user_id),
    role: row.role as LocationRole,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracy: row.accuracy == null ? undefined : Number(row.accuracy),
    speed: row.speed == null ? undefined : Number(row.speed),
    heading: row.heading == null ? undefined : Number(row.heading),
    altitude: row.altitude == null ? undefined : Number(row.altitude),
    online: row.online !== false,
    orderId: row.order_id == null ? undefined : String(row.order_id),
    city: row.city == null ? undefined : String(row.city),
    timestamp: String(row.updated_at),
    updatedAt: String(row.updated_at),
  };
}

export function deviceToRecord(
  userId: string,
  role: LocationRole,
  device: DeviceLocation,
  extra?: Partial<UserLocationRecord>
): UserLocationRecord {
  return {
    userId,
    role,
    latitude: device.latitude,
    longitude: device.longitude,
    accuracy: device.accuracy,
    speed: device.speed,
    heading: device.heading,
    altitude: device.altitude,
    timestamp: device.timestamp,
    updatedAt: device.timestamp,
    ...extra,
  };
}
