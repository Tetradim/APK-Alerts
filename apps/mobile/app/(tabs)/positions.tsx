import { EmptyStateScreen } from "@/screens/EmptyStateScreen";

export default function PositionsRoute() {
  return (
    <EmptyStateScreen
      title="Positions"
      description="Pair a real engine to show positions, fills, exits, protection state, and broker reconciliation."
    />
  );
}
