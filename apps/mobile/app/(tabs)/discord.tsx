import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { buildActionButtonAccessibility } from "@/components/actionButtonAccessibility";
import { buildDiscordWebViewUiState } from "@/state/discordWebViewState";
import { useSettingsState } from "@/state/settingsState";

const DISCORD_WEB_URL = "https://discord.com/channels/@me";
const DISCORD_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

export default function DiscordTab() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const webRef = useRef<WebView>(null);
  const settings = useSettingsState((state) => state.snapshot.discordIngestionSettings);
  const uiState = buildDiscordWebViewUiState(settings, { loading, error: loadError });

  const reload = () => {
    setLoadError("");
    setLoading(true);
    setReloadKey((current) => current + 1);
    webRef.current?.reload();
  };

  useEffect(() => {
    if (!uiState.renderWebView || !loading) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setLoadError("Discord WebView load timed out.");
      setLoading(false);
    }, 20_000);

    return () => clearTimeout(timeoutId);
  }, [loading, reloadKey, uiState.renderWebView]);

  if (!uiState.renderWebView) {
    return (
      <View style={styles.container}>
        <View style={styles.statusPanel}>
          <Text style={styles.statusTitle}>{uiState.titleLabel}</Text>
          <Text style={styles.statusDetail}>{uiState.detailLabel}</Text>
          {uiState.canRetry ? (
            <Pressable
              accessibilityRole="button"
              {...buildActionButtonAccessibility("Retry Discord WebView")}
              onPress={reload}
              style={styles.toolbarButton}
            >
              <Text style={styles.toolbarButtonText}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>{uiState.titleLabel}</Text>
        <Pressable
          accessibilityRole="button"
          {...buildActionButtonAccessibility("Reload Discord WebView")}
          onPress={reload}
          style={styles.toolbarButton}
        >
          <Text style={styles.toolbarButtonText}>Reload</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator style={styles.loading} color="#5865f2" /> : null}
      <WebView
        key={reloadKey}
        ref={webRef}
        source={{ uri: DISCORD_WEB_URL }}
        userAgent={DISCORD_USER_AGENT}
        onLoadStart={() => {
          setLoading(true);
          setLoadError("");
        }}
        onLoadEnd={() => setLoading(false)}
        onError={(event) => {
          setLoading(false);
          setLoadError(event.nativeEvent.description || "Discord WebView failed to load.");
        }}
        onHttpError={(event) => {
          setLoading(false);
          setLoadError(`Discord returned HTTP ${event.nativeEvent.statusCode}.`);
        }}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        mediaPlaybackRequiresUserAction={false}
        style={styles.webView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1e1f22",
    flex: 1,
  },
  loading: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 52,
    zIndex: 2,
  },
  statusPanel: {
    backgroundColor: "#111827",
    borderColor: "#334155",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    margin: 18,
    padding: 16,
  },
  statusTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
  },
  statusDetail: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 20,
  },
  toolbar: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderBottomColor: "#334155",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 14,
  },
  toolbarButton: {
    alignItems: "center",
    backgroundColor: "#5865f2",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 36,
    minWidth: 84,
    paddingHorizontal: 12,
  },
  toolbarButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  toolbarTitle: {
    color: "#f8fafc",
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
  },
  webView: {
    backgroundColor: "#1e1f22",
    flex: 1,
  },
});
