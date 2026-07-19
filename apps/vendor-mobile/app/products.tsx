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
import { VendorAPI } from "../lib/api";

export default function VendorProducts() {
  const [products, setProducts] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await VendorAPI.products();
      setProducts(data.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading && products.length === 0) {
    return <ActivityIndicator style={{ marginTop: 40 }} color="#FF6B00" />;
  }

  return (
    <FlatList
      data={products}
      keyExtractor={(_, i) => String(i)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      contentContainerStyle={{ padding: 16 }}
      ListEmptyComponent={
        <Text style={styles.empty}>
          {error || "No products. Apply as vendor and ensure platform catalog is up."}
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
