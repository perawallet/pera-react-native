/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */
package com.algorand.perarn.perawidgets.fetch

import android.net.http.X509TrustManagerExtensions
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyStore
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.time.Instant
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocketFactory
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

typealias HttpGet = suspend (url: String, apiKey: String) -> String?

object Http {
    // A widget refresh gets only a few seconds from the system; give up early and keep the cached quote.
    private const val TIMEOUT_MS = 8_000

    // Pinned to the feed's keys while its pinning is current; a connection the pins reject is a failed fetch.
    fun client(feed: WidgetSnapshot.PriceFeed?, now: Instant = Instant.now()): HttpGet =
        request(Pinning.activePins(feed?.pinning, now))

    // Cancelling the caller disconnects, so a withTimeout really bounds the request.
    private fun request(pins: Set<String>?): HttpGet = { url, apiKey ->
        suspendCancellableCoroutine { continuation ->
            val connection = try {
                open(url, pins)
            } catch (_: Exception) {
                null
            }
            if (connection == null) {
                continuation.resume(null)
            } else {
                continuation.invokeOnCancellation { connection.disconnect() }
                val body = try {
                    connection.connectTimeout = TIMEOUT_MS
                    connection.readTimeout = TIMEOUT_MS
                    connection.setRequestProperty("Content-Type", "application/json")
                    if (apiKey.isNotEmpty()) connection.setRequestProperty("X-API-Key", apiKey)
                    if (connection.responseCode == 200) connection.inputStream.bufferedReader().use { it.readText() } else null
                } catch (_: Exception) {
                    null
                } finally {
                    connection.disconnect()
                }
                continuation.resume(body)
            }
        }
    }

    private fun open(url: String, pins: Set<String>?): HttpURLConnection? {
        val connection = URL(url).openConnection() as HttpURLConnection
        if (pins == null) return connection
        // Plain HTTP would skip the check entirely.
        if (connection !is HttpsURLConnection) return null
        connection.sslSocketFactory = pinnedSocketFactory(connection.url.host, pins)
        return connection
    }

    private fun pinnedSocketFactory(host: String, pins: Set<String>): SSLSocketFactory {
        val factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        factory.init(null as KeyStore?)
        val system = factory.trustManagers.filterIsInstance<X509TrustManager>().first()
        val context = SSLContext.getInstance("TLS")
        context.init(null, arrayOf(PinningTrustManager(system, host, pins)), null)
        return context.socketFactory
    }
}

private class PinningTrustManager(
    private val system: X509TrustManager,
    private val host: String,
    private val pins: Set<String>,
) : X509TrustManager {
    override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {
        throw CertificateException("Client certificates are not used")
    }

    override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
        val presented: Array<X509Certificate> = chain?.map { it }?.toTypedArray() ?: throw CertificateException("No chain")
        // The hostname-aware system check honours the app's network security config and returns the chain it
        // built up to a trusted root. The pins are roots, which servers rarely send, so they are matched there.
        val verified = X509TrustManagerExtensions(system).checkServerTrusted(presented, authType ?: "", host)
        val keys = (verified + presented).map { it.publicKey.encoded }
        if (!Pinning.isPinned(keys, pins)) throw CertificateException("No pinned key in the chain for $host")
    }

    override fun getAcceptedIssuers(): Array<X509Certificate> = system.acceptedIssuers
}
