import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { RiderAPI } from "../lib/api";
import { useAuth } from "../lib/auth";
import { API_BASE } from "../lib/config";

export default function RiderHome() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [payload, setPayload] = useState<{
    rider: unknown;
    stats: unknown;
    availability: unknown;
    platformEnabled: boolean;
    warning?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineBusy, setOnlineBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    setError(null);
    try {
      setPayload(await RiderAPI.riderMe());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rider profile");
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} color="#E63946" />;
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Vantoo Rider</Text>
        <Text style={styles.subtitle}>
          Separate rider app — deliveries, availability, and GPS via `/api/rider/*`.
        </Text>
        <Link href="/login" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Rider login</Text>
          </Pressable>
        </Link>
        <Text style={styles.api}>API {API_BASE}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    >
      <Text style={styles.title}>Hi, {user.name}</Text>
      <Text style={styles.subtitle}>{user.email}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Platform connection</Text>
        <Text style={styles.meta}>
          Enabled: {String(payload?.platformEnabled ?? "—")}
          {"\n"}
          Rider record: {payload?.rider ? "linked" : "none / pending"}
          {"\n"}
          Availability: {JSON.stringify(payload?.availability ?? null)}
          {payload?.warning ? `\n${payload.warning}` : ""}
        </Text>
      </View>

      <Pressable
        style={[styles.button, onlineBusy && { opacity: 0.7 }]}
        disabled={onlineBusy}
        onPress={async () => {
          setOnlineBusy(true);
          try {
            await RiderAPI.setAvailability(true);
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not go online");
          } finally {
            setOnlineBusy(false);
          }
        }}
      >
        <Text style={styles.buttonText}>Go online</Text>
      </Pressable>
      <Pressable
        style={[styles.nav]}
        onPress={async () => {
          try {
            await RiderAPI.setAvailability(false);
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not go offline");
          }
        }}
      >
        <Text style={styles.navText}>Go offline</Text>
      </Pressable>

      <Pressable style={styles.nav} onPress={() => router.push("/deliveries")}>
        <Text style={styles.navText}>Deliveries</Text>
      </Pressable>
      <Pressable style={styles.nav} onPress={() => router.push("/earnings")}>
        <Text style={styles.navText}>Earnings</Text>
      </Pressable>
      <Pressable style={styles.nav} onPress={() => router.push("/location")}>
        <Text style={styles.navText}>Share GPS for order</Text>
      </Pressable>
      <Pressable style={styles.nav} onPress={() => router.push("/apply")}>
        <Text style={styles.navText}>Rider application / KYC</Text>
      </Pressable>
      <Pressable
        style={[styles.button, styles.logout]}
        onPress={async () => {
          await logout();
        }}
      >
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: "#F7F7F8" },
  title: { fontSize: 28, fontWeight: "700", color: "#111" },
  subtitle: { marginTop: 8, fontSize: 15, color: "#666", lineHeight: 22 },
  button: {
    marginTop: 20,
    backgroundColor: "#E63946",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  logout: { backgroundColor: "#333" },
  api: { marginTop: 16, color: "#999", fontSize: 12 },
  card: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8E8EA",
  },
  cardTitle: { fontWeight: "700", fontSize: 16 },
  meta: { marginTop: 8, color: "#555", lineHeight: 22 },
  error: { marginTop: 12, color: "#D32F2F" },
  nav: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8E8EA",
  },
  navText: { fontWeight: "700", fontSize: 16 },
});
