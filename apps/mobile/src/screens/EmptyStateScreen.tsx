import { StyleSheet, Text, View } from "react-native";
import { ScreenFrame } from "@/components/ScreenFrame";

interface EmptyStateScreenProps {
  title: string;
  description: string;
}

export function EmptyStateScreen({ title, description }: EmptyStateScreenProps) {
  return (
    <ScreenFrame title={title} eyebrow="APK-Alerts">
      <View style={styles.panel}>
        <Text style={styles.heading}>No paired event log</Text>
        <Text style={styles.copy}>{description}</Text>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: "#111827", borderColor: "#334155", borderRadius: 8, borderWidth: 1, padding: 16 },
  heading: { color: "#f8fafc", fontSize: 18, fontWeight: "900" },
  copy: { color: "#94a3b8", fontSize: 14, lineHeight: 20, marginTop: 8 },
});
