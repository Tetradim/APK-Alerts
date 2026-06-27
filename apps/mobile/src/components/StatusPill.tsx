import { StyleSheet, Text, View } from "react-native";

interface StatusPillProps {
  label: string;
  tone: "good" | "warn" | "bad" | "neutral";
}

const tones = {
  good: { backgroundColor: "#052e16", borderColor: "#22c55e", color: "#86efac" },
  warn: { backgroundColor: "#422006", borderColor: "#f59e0b", color: "#fcd34d" },
  bad: { backgroundColor: "#450a0a", borderColor: "#ef4444", color: "#fca5a5" },
  neutral: { backgroundColor: "#111827", borderColor: "#334155", color: "#cbd5e1" },
};

export function StatusPill({ label, tone }: StatusPillProps) {
  const toneStyles = tones[tone];

  return (
    <View style={[styles.root, { backgroundColor: toneStyles.backgroundColor, borderColor: toneStyles.borderColor }]}>
      <Text style={[styles.text, { color: toneStyles.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  text: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
});
