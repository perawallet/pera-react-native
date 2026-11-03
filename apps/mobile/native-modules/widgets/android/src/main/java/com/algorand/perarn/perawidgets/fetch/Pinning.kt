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

import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import java.security.MessageDigest
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.Base64

object Pinning {
    // Null means unpinned: no pinning in the snapshot, or past its expiry, the app's backstop that lets an
    // abandoned version fall back to plain TLS. A missing or unreadable expiry keeps the pins: the app asked for them.
    fun activePins(pinning: WidgetSnapshot.PriceFeed.Pinning?, now: Instant): Set<String>? {
        pinning ?: return null
        val expiry = pinning.expiresAt?.let(::parseExpiry)
        if (expiry != null && !now.isBefore(expiry)) return null
        return pinning.publicKeyHashes.orEmpty().toSet()
    }

    // The app writes either a full timestamp or a bare date ("2027-07-08", read as its start in UTC).
    fun parseExpiry(text: String): Instant? =
        runCatching { OffsetDateTime.parse(text).toInstant() }.getOrNull()
            ?: runCatching { Instant.parse(text) }.getOrNull()
            ?: runCatching { LocalDate.parse(text).atStartOfDay().toInstant(ZoneOffset.UTC) }.getOrNull()

    // `encodedPublicKey` is `PublicKey.encoded`, the SubjectPublicKeyInfo DER.
    fun spkiHash(encodedPublicKey: ByteArray): String =
        Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(encodedPublicKey))

    // An empty pin set matches nothing, so it fails closed.
    fun isPinned(encodedPublicKeys: List<ByteArray>, pins: Set<String>): Boolean =
        encodedPublicKeys.any { spkiHash(it) in pins }
}
