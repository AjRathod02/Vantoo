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
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { CustomerAPI, type Order } from "../../lib/api";
import { colors } from "../../lib/theme";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [tracking, setTracking] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [o, t] = await Promise.all([
        CustomerAPI.order(id),
        CustomerAPI.tracking(id).catch(() => ({ tracking: null })),
      ]);
      setOrder(o.order);
      setTracking(t.tracking);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load order");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const cancel = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const data = await CustomerAPI.cancelOrder(id);
      setOrder(data.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  };

  if (!order && !error) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {order ? (
        <>
          <Text style={styles.title}>Order #{order.id.slice(0, 8)}</Text>
          <Text style={styles.meta}>
            Status: {order.status}
            {"\n"}
            Total: ₹{order.total}
            {"\n"}
            Payment: {order.paymentMethod} ({order.paymentStatus || "—"})
          </Text>
          {(order.items || []).map((item, idx) => (
            <View key={`${item.name}-${idx}`} style={styles.item}>
              <Text style={styles.itemName}>
                {item.name} × {item.quantity}
              </Text>
              <Text style={styles.meta}>₹{item.price}</Text>
            </View>
          ))}
          <Text style={styles.section}>Live tracking</Text>
          <Text style={styles.meta}>
            {tracking ? JSON.stringify(tracking, null, 2) : "No tracking payload yet."}
          </Text>
          {order.status !== "cancelled" && order.status !== "delivered" ? (
            <Pressable
              style={[styles.button, busy && { opacity: 0.7 }]}
              onPress={cancel}
              disabled={busy}
            >
              <Text style={styles.buttonText}>Cancel order</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: "700" },
  meta: { marginTop: 8, color: colors.muted, lineHeight: 22 },
  section: { marginTop: 20, fontWeight: "700", fontSize: 16 },
  item: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemName: { fontWeight: "600" },
  error: { color: colors.danger, marginBottom: 12 },
  button: {
    marginTop: 24,
    backgroundColor: colors.danger,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
