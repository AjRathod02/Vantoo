import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { API_BASE } from "../lib/config";
import { colors } from "../lib/theme";

export default function AccountScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Not signed in</Text>
        <Pressable style={styles.button} onPress={() => router.push("/login")}>
          <Text style={styles.buttonText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{user.name}</Text>
      <Text style={styles.meta}>{user.email}</Text>
      <Text style={styles.meta}>{user.phone || "No phone"}</Text>
      <Text style={styles.api}>API: {API_BASE}</Text>
      <Pressable
        style={[styles.button, styles.secondary]}
        onPress={() => router.push("/orders")}
      >
        <Text style={styles.secondaryText}>My orders</Text>
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={async () => {
          await logout();
          router.replace("/");
        }}
      >
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: "700" },
  meta: { marginTop: 6, color: colors.muted },
  api: { marginTop: 16, marginBottom: 24, color: colors.muted, fontSize: 12 },
  button: {
    backgroundColor: colors.brand,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  secondary: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  secondaryText: { fontWeight: "700", color: colors.text },
});
