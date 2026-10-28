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

import java.net.HttpURLConnection
import java.net.URL
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

typealias HttpGet = suspend (url: String, apiKey: String) -> String?

object Http {
    // A widget refresh gets only a few seconds from the system; give up early and keep the cached quote.
    private const val TIMEOUT_MS = 8_000

    // Cancelling the caller disconnects, so a withTimeout really bounds the request.
    val get: HttpGet = { url, apiKey ->
        suspendCancellableCoroutine { continuation ->
            val connection = try {
                URL(url).openConnection() as HttpURLConnection
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
}
