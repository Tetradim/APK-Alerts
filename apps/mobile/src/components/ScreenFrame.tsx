import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getScreenFrameBottomPadding } from "./screenFrameLayout";

interface ScreenFrameProps {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}

export function ScreenFrame({ title, eyebrow, children }: ScreenFrameProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: getScreenFrameBottomPadding(insets.bottom),
          paddingTop: insets.top + 18,
        },
      ]}
    >
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a" },
  content: { paddingHorizontal: 18, paddingBottom: 32 },
  eyebrow: { color: "#94a3b8", fontSize: 12, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  title: { color: "#f8fafc", fontSize: 28, fontWeight: "900", marginTop: 6 },
  body: { marginTop: 18, gap: 12 },
});
