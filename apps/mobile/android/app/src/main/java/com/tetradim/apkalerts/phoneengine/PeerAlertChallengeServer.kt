package com.tetradim.apkalerts.phoneengine

import android.content.Context
import org.json.JSONObject
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import java.time.Instant

object PeerAlertChallengeServer {
  const val PORT = 42117
  private const val PATH = "/api/peer-alert/challenges"
  private const val CLIENT_READ_TIMEOUT_MS = 5_000
  private const val MAX_BODY_BYTES = 65_536

  @Volatile private var running = false
  private var serverSocket: ServerSocket? = null
  private var serverThread: Thread? = null

  @Synchronized
  fun start(context: Context) {
    if (running) {
      return
    }

    val appContext = context.applicationContext
    running = true
    serverThread = Thread({
      runServer(appContext)
    }, "apk-alerts-peer-alert-server").apply {
      isDaemon = true
      start()
    }
  }

  @Synchronized
  fun stop(context: Context) {
    running = false
    runCatching { serverSocket?.close() }
    serverSocket = null
    serverThread = null
    PhoneEngineRuntimeRegistry.markPeerAlertServerState(context.applicationContext, false, "stopped")
  }

  private fun runServer(context: Context) {
    try {
      // Bind all interfaces (0.0.0.0) so Tailscale and same-Wi-Fi remotes can challenge the phone.
      ServerSocket(PORT).use { socket ->
        serverSocket = socket
        socket.soTimeout = 1_000
        PhoneEngineRuntimeRegistry.markPeerAlertServerState(context, true, "listening")
        while (running) {
          try {
            socket.accept().use { client -> handleClient(client) }
          } catch (_: SocketTimeoutException) {
            // Periodic timeout lets the loop observe stop requests.
          }
        }
      }
    } catch (error: Exception) {
      if (running) {
        PhoneEngineRuntimeRegistry.markPeerAlertServerState(
          context,
          false,
          "failed:${error.message ?: "unknown"}",
        )
      }
    } finally {
      serverSocket = null
      running = false
    }
  }

  private fun handleClient(socket: Socket) {
    socket.soTimeout = CLIENT_READ_TIMEOUT_MS
    val reader = BufferedReader(InputStreamReader(socket.getInputStream(), Charsets.UTF_8))
    val writer = BufferedWriter(OutputStreamWriter(socket.getOutputStream(), Charsets.UTF_8))
    val requestLine = reader.readLine().orEmpty()
    val requestParts = requestLine.split(" ")
    if (requestParts.size < 2) {
      writeJson(writer, 400, JSONObject().put("error", "Invalid peer alert request."))
      return
    }

    val method = requestParts[0].uppercase()
    val path = requestParts[1].substringBefore("?")
    val headers = readHeaders(reader)
    val contentLength = headers["content-length"]?.toIntOrNull() ?: 0
    if (contentLength > MAX_BODY_BYTES) {
      writeJson(writer, 413, JSONObject().put("error", "Peer alert request body is too large."))
      return
    }
    val body = readBody(reader, contentLength.coerceAtLeast(0))

    if (path != PATH) {
      writeJson(writer, 404, JSONObject().put("error", "Peer alert endpoint not found."))
      return
    }
    if (method != "POST") {
      writeJson(writer, 405, JSONObject().put("error", "Peer alert endpoint requires POST."))
      return
    }

    val challenge = runCatching { JSONObject(body) }.getOrNull()
    if (challenge == null) {
      writeJson(writer, 400, JSONObject().put("error", "Peer alert challenge payload invalid."))
      return
    }

    writeJson(writer, 200, JSONObject().put("response", buildResponseEvent(challenge)))
  }

  private fun readHeaders(reader: BufferedReader): Map<String, String> {
    val headers = mutableMapOf<String, String>()
    while (true) {
      val line = reader.readLine() ?: break
      if (line.isEmpty()) {
        break
      }
      val separatorIndex = line.indexOf(":")
      if (separatorIndex > 0) {
        headers[line.substring(0, separatorIndex).trim().lowercase()] =
          line.substring(separatorIndex + 1).trim()
      }
    }
    return headers
  }

  private fun readBody(reader: BufferedReader, length: Int): String {
    if (length <= 0) {
      return ""
    }
    val chars = CharArray(length)
    val read = reader.read(chars, 0, length)
    return if (read > 0) String(chars, 0, read) else ""
  }

  private fun buildResponseEvent(challenge: JSONObject): JSONObject {
    val now = nowIso()
    val challengePayload = challenge.optJSONObject("payload") ?: JSONObject()
    val challengeId = challengePayload.optString("challengeId")
    val leaseId = challengePayload.optString("leaseId")
    val sequence = challenge.optLong("sequence", 0L) + 1L
    val lastAlertSnapshot = PhoneEngineRuntimeRegistry.lastAlertSnapshotJson()
    val lastAlert = lastAlertSnapshot?.optJSONObject("fingerprint")

    val payload = JSONObject()
      .put("challengeId", challengeId)
      .put("leaseId", leaseId)
      .put("responderEngineId", "phone:android")
      .put("respondedAt", now)
      .put("phoneObservedAt", lastAlertSnapshot?.optString("observedAt") ?: now)
      .put("phoneReceivedAt", lastAlertSnapshot?.optString("receivedAt") ?: now)
      .put("lastAlert", lastAlert ?: JSONObject.NULL)

    return JSONObject()
      .put("id", "peer-response:$challengeId")
      .put("type", "alert.peer.response.v1")
      .put("schemaVersion", 1)
      .put("sourceEngineId", "phone:android")
      .put("observedAt", now)
      .put("sequence", sequence)
      .put("previousEventId", JSONObject.NULL)
      .put("idempotencyKey", JSONObject.NULL)
      .put("payload", payload)
  }

  private fun writeJson(writer: BufferedWriter, status: Int, body: JSONObject) {
    val payload = body.toString()
    writer.write("HTTP/1.1 $status ${statusText(status)}\r\n")
    writer.write("Content-Type: application/json\r\n")
    writer.write("Content-Length: ${payload.toByteArray(Charsets.UTF_8).size}\r\n")
    writer.write("Connection: close\r\n")
    writer.write("\r\n")
    writer.write(payload)
    writer.flush()
  }

  private fun statusText(status: Int): String =
    when (status) {
      200 -> "OK"
      400 -> "Bad Request"
      404 -> "Not Found"
      405 -> "Method Not Allowed"
      413 -> "Payload Too Large"
      else -> "Error"
    }

  private fun nowIso(): String = Instant.now().toString()
}
