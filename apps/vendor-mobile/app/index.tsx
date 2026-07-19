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
import { VendorAPI } from "../lib/api";
import { useAuth } from "../lib/auth";
import { API_BASE } from "../lib/config";

export default function VendorHome() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [vendorPayload, setVendorPayload] = useState<{
    vendor: unknown;
    stats: unknown;
    platformEnabled: boolean;
    warning?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    setError(null);
    try {
      const data = await VendorAPI.vendorMe();
      setVendorPayload(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vendor profile");
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
    return <ActivityIndicator style={{ marginTop: 40 }} color="#FF6B00" />;
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Vantoo Vendor</Text>
        <Text style={styles.subtitle}>
          Separate vendor app — stores, catalog, and orders via `/api/vendor/*`.
        </Text>
        <Link href="/login" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Vendor login</Text>
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
          Enabled: {String(vendorPayload?.platformEnabled ?? "—")}
          {"\n"}
          Vendor record: {vendorPayload?.vendor ? "linked" : "none / pending"}
          {vendorPayload?.warning ? `\n${vendorPayload.warning}` : ""}
        </Text>
        {!vendorPayload?.platformEnabled ? (
          <Text style={styles.hint}>
            Start platform services (`npm run platform:dev:all`) or keep browsing
            apply/orders endpoints which degrade gracefully.
          </Text>
        ) : null}
      </View>

      <Pressable style={styles.nav} onPress={() => router.push("/orders")}>
        <Text style={styles.navText}>Orders</Text>
      </Pressable>
      <Pressable style={styles.nav} onPress={() => router.push("/products")}>
        <Text style={styles.navText}>Products</Text>
      </Pressable>
      <Pressable style={styles.nav} onPress={() => router.push("/apply")}>
        <Text style={styles.navText}>Vendor application / KYC</Text>
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
    marginTop: 28,
    backgroundColor: "#FF6B00",
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
  hint: { marginTop: 10, color: "#888", lineHeight: 20 },
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
