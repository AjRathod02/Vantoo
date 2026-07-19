import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useCart } from "../lib/cart";
import { colors } from "../lib/theme";

export default function CartScreen() {
  const { lines, setQty, remove, subtotal, count } = useCart();
  const router = useRouter();

  if (count === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Your cart is empty</Text>
        <Pressable style={styles.button} onPress={() => router.replace("/")}>
          <Text style={styles.buttonText}>Browse products</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={lines}
        keyExtractor={(item) => item.product.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.product.name}</Text>
              <Text style={styles.meta}>
                ₹{item.product.price} × {item.quantity}
              </Text>
            </View>
            <View style={styles.qtyRow}>
              <Pressable
                style={styles.qtyBtn}
                onPress={() => setQty(item.product.id, item.quantity - 1)}
              >
                <Text>-</Text>
              </Pressable>
              <Text style={styles.qty}>{item.quantity}</Text>
              <Pressable
                style={styles.qtyBtn}
                onPress={() => setQty(item.product.id, item.quantity + 1)}
              >
                <Text>+</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => remove(item.product.id)}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        )}
      />
      <View style={styles.footer}>
        <Text style={styles.total}>Subtotal ₹{subtotal.toFixed(0)}</Text>
        <Pressable style={styles.button} onPress={() => router.push("/checkout")}>
          <Text style={styles.buttonText}>Checkout (COD)</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  name: { fontWeight: "700", fontSize: 16 },
  meta: { color: colors.muted, marginTop: 4 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  qty: { fontWeight: "700", minWidth: 20, textAlign: "center" },
  remove: { color: colors.danger, fontWeight: "600" },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: "#fff",
  },
  total: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  button: {
    backgroundColor: colors.brand,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
