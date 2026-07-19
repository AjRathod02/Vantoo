import * as Location from "expo-location";
import { RiderAPI } from "./api";

export async function requestLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function getCurrentCoords() {
  const granted = await requestLocationPermission();
  if (!granted) throw new Error("Location permission denied");
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    heading: pos.coords.heading ?? undefined,
    speed: pos.coords.speed ?? undefined,
  };
}

export async function uploadRiderLocation(orderId: string) {
  const coords = await getCurrentCoords();
  return RiderAPI.postLocation({ orderId, ...coords });
}
