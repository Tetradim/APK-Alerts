import { Pressable, StyleSheet, Text, View } from "react-native";

interface SegmentedChoiceOption<TValue extends string> {
  label: string;
  value: TValue;
}

interface SegmentedChoiceProps<TValue extends string> {
  label: string;
  value: TValue;
  options: readonly SegmentedChoiceOption<TValue>[];
  onChange: (value: TValue) => void;
}

export function SegmentedChoice<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedChoiceProps<TValue>) {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value}
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[styles.option, selected ? styles.selectedOption : styles.unselectedOption]}
            >
              <Text style={[styles.optionText, selected ? styles.selectedText : styles.unselectedText]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  label: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  options: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    padding: 3,
  },
  option: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  selectedOption: {
    backgroundColor: "#22c55e",
  },
  unselectedOption: {
    backgroundColor: "transparent",
  },
  optionText: {
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  selectedText: {
    color: "#052e16",
  },
  unselectedText: {
    color: "#cbd5e1",
  },
});
