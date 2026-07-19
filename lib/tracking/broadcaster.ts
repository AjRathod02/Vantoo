import { EventEmitter } from "events";
import type { RiderLocationUpdate, UserLocationRecord } from "@/lib/types";
import {
  getRedisPublisher,
  getRedisSubscriber,
  redisKey,
} from "@/lib/redis/client";

type TrackingGlobals = {
  vantooTrackingEmitter?: EventEmitter;
  vantooTrackingSubscriberReady?: Promise<void>;
};

const globals = globalThis as unknown as TrackingGlobals;
const trackingEmitter =
  globals.vantooTrackingEmitter ?? new EventEmitter().setMaxListeners(1_000);
globals.vantooTrackingEmitter = trackingEmitter;

export function orderChannel(orderId: string) {
  return `order:${orderId}`;
}

export function userChannel(userId: string) {
  return `user:${userId}`;
}

export const ADMIN_LOCATIONS_CHANNEL = "admin:locations";

function redisChannel(logicalChannel: string) {
  return redisKey("tracking", logicalChannel);
}

function allowMemoryFallback() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.TRACKING_MEMORY_FALLBACK === "true"
  );
}

async function ensureSubscriber() {
  if (globals.vantooTrackingSubscriberReady) {
    return globals.vantooTrackingSubscriberReady;
  }
  globals.vantooTrackingSubscriberReady = (async () => {
    const subscriber = getRedisSubscriber();
    if (!subscriber) {
      if (allowMemoryFallback()) return;
      throw new Error("Redis tracking subscriber is unavailable");
    }
    subscriber.on("pmessage", (_pattern, channel, message) => {
      const prefix = `${redisKey("tracking")}:`;
      if (!channel.startsWith(prefix)) return;
      const logicalChannel = channel.slice(prefix.length);
      try {
        trackingEmitter.emit(logicalChannel, JSON.parse(message));
      } catch (error) {
        console.error("Invalid Redis tracking payload:", error);
      }
    });
    await subscriber.psubscribe(`${redisKey("tracking")}:*`);
  })();
  return globals.vantooTrackingSubscriberReady;
}

async function publish(logicalChannel: string, payload: unknown) {
  const publisher = getRedisPublisher();
  if (!publisher) {
    if (allowMemoryFallback()) {
      trackingEmitter.emit(logicalChannel, payload);
      return;
    }
    throw new Error("Redis tracking publisher is unavailable");
  }
  await publisher.publish(redisChannel(logicalChannel), JSON.stringify(payload));
}

async function subscribe<T>(
  logicalChannel: string,
  listener: (payload: T) => void
) {
  await ensureSubscriber();
  trackingEmitter.on(logicalChannel, listener);
  return () => trackingEmitter.off(logicalChannel, listener);
}

export async function publishRiderLocation(
  orderId: string,
  payload: RiderLocationUpdate
) {
  await publish(orderChannel(orderId), payload);
}

export function subscribeRiderLocation(
  orderId: string,
  listener: (payload: RiderLocationUpdate) => void
) {
  return subscribe(orderChannel(orderId), listener);
}

export async function publishUserLocation(record: UserLocationRecord) {
  const publications: Promise<void>[] = [
    publish(userChannel(record.userId), record),
    publish(ADMIN_LOCATIONS_CHANNEL, record),
  ];
  if (record.orderId) {
    publications.push(
      publish(orderChannel(record.orderId), {
        orderId: record.orderId,
        lat: record.latitude,
        lng: record.longitude,
        speed: record.speed,
        heading: record.heading,
        timestamp: record.updatedAt,
      } satisfies RiderLocationUpdate)
    );
  }
  await Promise.all(publications);
}

export function subscribeUserLocation(
  userId: string,
  listener: (record: UserLocationRecord) => void
) {
  return subscribe(userChannel(userId), listener);
}

export function subscribeAdminLocations(
  listener: (record: UserLocationRecord) => void
) {
  return subscribe(ADMIN_LOCATIONS_CHANNEL, listener);
}
