import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { CustomerAPI, type Order } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { colors } from "../../lib/theme";

export default function OrdersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await CustomerAPI.orders();
      setOrders(data.orders ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Sign in to view orders.</Text>
        <Pressable style={styles.button} onPress={() => router.push("/login")}>
          <Text style={styles.buttonText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  if (loading && orders.length === 0) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />;
  }

  return (
    <FlatList
      data={orders}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      contentContainerStyle={{ padding: 16 }}
      ListEmptyComponent={
        <Text style={styles.message}>{error || "No orders yet."}</Text>
      }
      renderItem={({ item }) => (
        <Link href={`/orders/${item.id}`} asChild>
          <Pressable style={styles.card}>
            <Text style={styles.id}>#{item.id.slice(0, 8)}</Text>
            <Text style={styles.meta}>
              {item.status} · ₹{item.total} · {item.paymentMethod || "—"}
            </Text>
          </Pressable>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  message: { color: colors.muted, marginBottom: 12 },
  button: {
    backgroundColor: colors.brand,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  id: { fontWeight: "700", fontSize: 16 },
  meta: { marginTop: 4, color: colors.muted },
});
