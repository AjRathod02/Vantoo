import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { RiderAPI } from "../lib/api";

export default function DeliveriesScreen() {
  const [deliveries, setDeliveries] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await RiderAPI.deliveries();
      setDeliveries(data.deliveries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading && deliveries.length === 0) {
    return <ActivityIndicator style={{ marginTop: 40 }} color="#E63946" />;
  }

  return (
    <FlatList
      data={deliveries}
      keyExtractor={(_, i) => String(i)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      contentContainerStyle={{ padding: 16 }}
      ListEmptyComponent={
        <Text style={styles.empty}>
          {error || "No deliveries. Approve rider + run platform services for live jobs."}
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.text}>{JSON.stringify(item, null, 2)}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { color: "#666", lineHeight: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E8E8EA",
  },
  text: { fontSize: 12, color: "#333" },
});
