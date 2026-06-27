import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

const DISCORD_WEB_URL = "https://discord.com/channels/@me";
const DISCORD_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

export default function DiscordTab() {
  const [loading, setLoading] = useState(true);
  const webRef = useRef<WebView>(null);

  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator style={StyleSheet.absoluteFill} color="#5865f2" /> : null}
      <WebView
        ref={webRef}
        source={{ uri: DISCORD_WEB_URL }}
        userAgent={DISCORD_USER_AGENT}
        onLoadEnd={() => setLoading(false)}
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
  webView: {
    backgroundColor: "#1e1f22",
    flex: 1,
  },
});
