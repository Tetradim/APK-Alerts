import { StyleSheet, Text, View } from "react-native";

interface MetricTileProps {
  label: string;
  value: string;
  detail: string;
}

export function MetricTile({ label, value, detail }: MetricTileProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 92, backgroundColor: "#111827", borderColor: "#334155", borderRadius: 8, borderWidth: 1, padding: 12 },
  label: { color: "#94a3b8", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  value: { color: "#f8fafc", fontSize: 17, fontWeight: "900", marginTop: 8 },
  detail: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
});
