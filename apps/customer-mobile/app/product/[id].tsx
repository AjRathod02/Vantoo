import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { CustomerAPI, type Product } from "../../lib/api";
import { useCart } from "../../lib/cart";
import { colors } from "../../lib/theme";

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { add } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    CustomerAPI.product(id)
      .then((d) => setProduct(d.product))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [id]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!product) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {product.image ? (
        <Image source={{ uri: product.image }} style={styles.image} />
      ) : null}
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.price}>₹{product.price}</Text>
      <Text style={styles.desc}>{product.description || "No description."}</Text>
      <Pressable style={styles.button} onPress={() => add(product)}>
        <Text style={styles.buttonText}>Add to cart</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: colors.bg },
  center: { padding: 24 },
  image: { width: "100%", height: 220, borderRadius: 16, backgroundColor: "#eee" },
  name: { marginTop: 16, fontSize: 24, fontWeight: "700", color: colors.text },
  price: { marginTop: 8, fontSize: 20, fontWeight: "700", color: colors.brand },
  desc: { marginTop: 12, color: colors.muted, lineHeight: 22 },
  button: {
    marginTop: 24,
    backgroundColor: colors.brand,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: colors.danger },
});
