import * as SecureStore from "expo-secure-store";

const ACCESS = "vantoo_rider_access";
const REFRESH = "vantoo_rider_refresh";
const USER = "vantoo_rider_user";

export type SessionUser = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
};

export async function saveSession(
  session: { accessToken: string; refreshToken: string },
  user: SessionUser
) {
  await SecureStore.setItemAsync(ACCESS, session.accessToken);
  if (session.refreshToken) {
    await SecureStore.setItemAsync(REFRESH, session.refreshToken);
  } else {
    await SecureStore.deleteItemAsync(REFRESH);
  }
  await SecureStore.setItemAsync(USER, JSON.stringify(user));
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
  await SecureStore.deleteItemAsync(USER);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH);
}

export async function getStoredUser(): Promise<SessionUser | null> {
  const raw = await SecureStore.getItemAsync(USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function updateTokens(session: {
  accessToken: string;
  refreshToken: string;
}) {
  await SecureStore.setItemAsync(ACCESS, session.accessToken);
  await SecureStore.setItemAsync(REFRESH, session.refreshToken);
}
