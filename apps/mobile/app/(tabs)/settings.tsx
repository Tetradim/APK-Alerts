import { EmptyStateScreen } from "@/screens/EmptyStateScreen";

export default function SettingsRoute() {
  return (
    <EmptyStateScreen
      title="Settings"
      description="Configure real engine pairing, failover notifications, transport preference, Discord, broker, and risk controls."
    />
  );
}
