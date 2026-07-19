import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { CustomerAPI } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import { colors } from "../lib/theme";

export default function CheckoutScreen() {
  const { user } = useAuth();
  const { lines, subtotal, clear } = useCart();
  const router = useRouter();
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(
    `mobile-${user?.id ?? "guest"}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Sign in to place an order.</Text>
        <Pressable style={styles.button} onPress={() => router.push("/login")}>
          <Text style={styles.buttonText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  if (lines.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Cart is empty.</Text>
      </View>
    );
  }

  const placeOrder = async () => {
    if (!line1.trim() || !city.trim() || pincode.trim().length < 5) {
      setError("Enter a complete delivery address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const service =
        (lines[0]?.product.service as
          | "food"
          | "grocery"
          | "medicine"
          | "ecommerce"
          | "local_shop"
          | undefined) || "grocery";
      const order = await CustomerAPI.createOrder({
        items: lines.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          name: l.product.name,
          image: l.product.image,
        })),
        paymentMethod: "cod",
        idempotencyKey: idempotencyKey.current,
        service,
        address: {
          id: `mobile-${Date.now()}`,
          label: "Home",
          line1: line1.trim(),
          line2: "",
          city: city.trim(),
          pincode: pincode.trim(),
          isDefault: true,
        },
      });
      clear();
      router.replace(`/orders/${order.order.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Cash on delivery</Text>
      <Text style={styles.meta}>Items subtotal ₹{subtotal.toFixed(0)}</Text>
      <Text style={styles.label}>Address line</Text>
      <TextInput style={styles.input} value={line1} onChangeText={setLine1} placeholder="House / street" />
      <Text style={styles.label}>City</Text>
      <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" />
      <Text style={styles.label}>Pincode</Text>
      <TextInput
        style={styles.input}
        value={pincode}
        onChangeText={setPincode}
        placeholder="560001"
        keyboardType="number-pad"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.button, busy && { opacity: 0.7 }]}
        onPress={placeOrder}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Place COD order</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  message: { fontSize: 16, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  meta: { marginTop: 6, marginBottom: 20, color: colors.muted },
  label: { fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  error: { color: colors.danger, marginBottom: 12 },
  button: {
    backgroundColor: colors.brand,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
