import { StyleSheet, Text, View } from "react-native";

export function CockpitScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>APK-Alerts</Text>
      <Text style={styles.title}>Operator Cockpit</Text>
      <View style={styles.panel}>
        <Text style={styles.heading}>No engine paired</Text>
        <Text style={styles.copy}>
          Pair a real Remote Engine before alerts, positions, lease state, or trading controls become available.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a", paddingHorizontal: 18, paddingTop: 56 },
  eyebrow: { color: "#94a3b8", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  title: { color: "#f8fafc", fontSize: 28, fontWeight: "900", marginTop: 6 },
  panel: { backgroundColor: "#111827", borderColor: "#334155", borderRadius: 8, borderWidth: 1, marginTop: 18, padding: 16 },
  heading: { color: "#f8fafc", fontSize: 18, fontWeight: "900" },
  copy: { color: "#94a3b8", fontSize: 14, lineHeight: 20, marginTop: 8 },
});
