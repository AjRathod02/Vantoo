import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../lib/auth";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#fff" },
          contentStyle: { backgroundColor: "#F7F7F8" },
          title: "Vantoo Rider",
        }}
      />
    </AuthProvider>
  );
}
