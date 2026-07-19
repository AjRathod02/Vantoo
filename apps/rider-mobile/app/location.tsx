import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { uploadRiderLocation } from "../lib/location";

export default function LocationScreen() {
  const [orderId, setOrderId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Share GPS</Text>
      <Text style={styles.hint}>
        Requires an assigned order and an approved rider account. Location is posted to
        `/api/rider/location`.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Order ID"
        value={orderId}
        onChangeText={setOrderId}
        autoCapitalize="none"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      <Pressable
        style={styles.button}
        disabled={busy}
        onPress={async () => {
          if (!orderId.trim()) {
            setError("Enter an order ID");
            return;
          }
          setBusy(true);
          setError(null);
          setMessage(null);
          try {
            await uploadRiderLocation(orderId.trim());
            setMessage("Location uploaded.");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Upload failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Upload current location</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#F7F7F8" },
  title: { fontSize: 22, fontWeight: "700" },
  hint: { marginTop: 8, marginBottom: 16, color: "#666", lineHeight: 20 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E8EA",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#E63946",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  error: { color: "#D32F2F", marginBottom: 12 },
  ok: { color: "#2E7D32", marginBottom: 12 },
});
