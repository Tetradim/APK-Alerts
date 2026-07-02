import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const nativeRoot = new URL(
  "../../android/app/src/main/java/com/tetradim/sentinelnexus/phoneengine/",
  import.meta.url,
);

function readNativeFile(name: string): string {
  return readFileSync(new URL(name, nativeRoot), "utf8");
}

test("native Discord gateway uses thread-safe state and session resume", () => {
  const source = readNativeFile("DiscordGatewayWorker.kt");

  assert.match(source, /AtomicReference<Long\?>/);
  assert.match(source, /@Volatile\s+private var heartbeatIntervalMs/);
  assert.match(source, /@Volatile\s+private var sessionId/);
  assert.match(source, /DISCORD_INTENTS = 33280/);
  assert.match(source, /private fun resume/);
  assert.match(source, /put\("op", 6\)/);
  assert.match(source, /connectionGeneration/);
  assert.match(source, /currentSocket/);
  assert.match(source, /currentGeneration/);
  assert.match(source, /nextReconnectDelayMs\(\)/);
});

test("native peer challenge server caps request bodies and client read time", () => {
  const source = readNativeFile("PeerAlertChallengeServer.kt");

  assert.match(source, /MAX_BODY_BYTES = 65_536/);
  assert.match(source, /socket\.soTimeout = CLIENT_READ_TIMEOUT_MS/);
  assert.match(source, /contentLength > MAX_BODY_BYTES/);
  assert.match(source, /ServerSocket\(PORT\)/);
  assert.match(source, /0\.0\.0\.0|all interfaces/i);
});

test("native Discord settings reconfigure active gateway without waiting for service restart", () => {
  const source = readNativeFile("PhoneEngineRuntimeModule.kt");

  assert.match(source, /DiscordGatewayWorker\.reconfigure/);
});
