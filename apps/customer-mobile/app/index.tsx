import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { CustomerAPI, type Product } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import { colors } from "../lib/theme";

export default function HomeScreen() {
  const { user } = useAuth();
  const { count, add } = useCart();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await CustomerAPI.products(query);
      setProducts(data.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.hello}>
          {user ? `Hi, ${user.name}` : "Welcome to Vantoo"}
        </Text>
        <View style={styles.navRow}>
          <Pressable onPress={() => router.push("/orders")} style={styles.chip}>
            <Text style={styles.chipText}>Orders</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/cart")} style={styles.chip}>
            <Text style={styles.chipText}>Cart ({count})</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(user ? "/account" : "/login")}
            style={[styles.chip, styles.chipBrand]}
          >
            <Text style={styles.chipBrandText}>{user ? "Account" : "Sign in"}</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.search}
          placeholder="Search food, grocery, medicine…"
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => load(q.trim() || undefined)}
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Text style={styles.hint}>
            Start the Next.js API (`npm run dev`) and set EXPO_PUBLIC_API_URL.
          </Text>
          <Pressable style={styles.retry} onPress={() => load(q || undefined)}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={styles.hint}>No products found.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Link href={`/product/${item.id}`} asChild>
                <Pressable style={styles.cardMain}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.image} />
                  ) : (
                    <View style={[styles.image, styles.imagePlaceholder]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.meta}>{item.service || item.category}</Text>
                    <Text style={styles.price}>₹{item.price}</Text>
                  </View>
                </Pressable>
              </Link>
              <Pressable style={styles.addBtn} onPress={() => add(item)}>
                <Text style={styles.addText}>Add</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  hello: { fontSize: 22, fontWeight: "700", color: colors.text },
  navRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontWeight: "600", color: colors.text },
  chipBrand: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipBrandText: { fontWeight: "700", color: "#fff" },
  search: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardMain: { flexDirection: "row", gap: 12 },
  image: { width: 72, height: 72, borderRadius: 10, backgroundColor: "#eee" },
  imagePlaceholder: { backgroundColor: "#ddd" },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  meta: { marginTop: 2, color: colors.muted, fontSize: 13 },
  price: { marginTop: 6, fontWeight: "700", color: colors.brand },
  addBtn: {
    marginTop: 10,
    alignSelf: "flex-end",
    backgroundColor: colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addText: { color: "#fff", fontWeight: "700" },
  center: { padding: 24, alignItems: "center" },
  error: { color: colors.danger, fontWeight: "600", textAlign: "center" },
  hint: { marginTop: 8, color: colors.muted, textAlign: "center", lineHeight: 20 },
  retry: {
    marginTop: 16,
    backgroundColor: colors.text,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: "#fff", fontWeight: "600" },
});
