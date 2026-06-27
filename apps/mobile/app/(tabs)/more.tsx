import { EmptyStateScreen } from "@/screens/EmptyStateScreen";

export default function MoreRoute() {
  return (
    <EmptyStateScreen
      title="More"
      description="View logs, diagnostics, account status, help, exports, and app details. Mobile does not run backtests or replays."
    />
  );
}
