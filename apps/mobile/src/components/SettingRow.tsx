import { StyleSheet, Switch, Text, View } from "react-native";

interface SettingRowProps {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function SettingRow({ label, description, value, onValueChange }: SettingRowProps) {
  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? "#dcfce7" : "#cbd5e1"}
        trackColor={{ false: "#334155", true: "#166534" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    minHeight: 64,
    paddingVertical: 10,
  },
  copy: {
    flex: 1,
  },
  label: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "800",
  },
  description: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
});
