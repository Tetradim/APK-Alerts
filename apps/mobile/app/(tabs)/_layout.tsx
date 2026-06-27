import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

function tabIcon(name: IconName) {
  return function Icon({ color, size }: { color: ColorValue; size: number }) {
    return <MaterialCommunityIcons name={name} color={color} size={size} />;
  };
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#22c55e",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          backgroundColor: "#0f172a",
          borderTopColor: "#1f2937",
          minHeight: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Cockpit", tabBarIcon: tabIcon("view-dashboard-outline") }} />
      <Tabs.Screen name="alerts" options={{ title: "Alerts", tabBarIcon: tabIcon("bell-outline") }} />
      <Tabs.Screen name="discord" options={{ title: "Discord", tabBarIcon: tabIcon("message-text-outline") }} />
      <Tabs.Screen name="positions" options={{ title: "Positions", tabBarIcon: tabIcon("chart-line") }} />
      <Tabs.Screen name="engines" options={{ title: "Engines", tabBarIcon: tabIcon("server-network") }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: tabIcon("cog-outline") }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: tabIcon("dots-horizontal-circle-outline") }} />
    </Tabs>
  );
}
