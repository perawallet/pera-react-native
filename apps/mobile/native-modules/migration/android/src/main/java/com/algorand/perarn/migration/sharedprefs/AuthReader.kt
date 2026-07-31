/*
 * Copyright 2022-2026 Pera Wallet, LDA
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License
 */
package com.algorand.perarn.migration.sharedprefs

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import android.util.Log
import com.algorand.perarn.migration.bridge.Base64Util
import com.algorand.perarn.migration.bridge.LegacyMigrationConstants
import com.algorand.perarn.migration.encryption.TinkAeadProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

private val LEGACY_LIST_PIN_RE = Regex("""^\[\s*\d+(?:\s*,\s*\d+)*\s*]$""")

internal class AuthReader(
    private val prefs: SharedPreferences,
    private val context: Context,
) {

    fun build(): WritableMap {
        val auth = Arguments.createMap()
        val pin = decryptEncryptedPin()?.let(::normalizeLegacyPinString)
        if (pin != null) {
            auth.putString("pin", Base64Util.encode(pin.toByteArray(Charsets.UTF_8)))
        } else {
            auth.putNull("pin")
        }
        return auth
    }

    // Legacy PIN was serialized as a Kotlin List<Int>.toString() ("[1, 2, 3]") before encryption; reduce to digit string.
    private fun normalizeLegacyPinString(raw: String): String {
        val trimmed = raw.trim()
        if (!LEGACY_LIST_PIN_RE.matches(trimmed)) return raw
        return trimmed
            .substring(1, trimmed.length - 1)
            .split(',')
            .joinToString(separator = "") { it.trim() }
    }

    private fun decryptEncryptedPin(): String? {
        val ciphertextBase64 = prefs.optString("encrypted_pin") ?: return null
        val ciphertext = try {
            Base64.decode(ciphertextBase64, Base64.DEFAULT)
        } catch (t: Throwable) {
            Log.w(LegacyMigrationConstants.LOG_TAG, "encrypted_pin is not valid base64", t)
            return null
        }
        val plaintext = try {
            TinkAeadProvider.open(context).decrypt(ciphertext, null)
        } catch (t: Throwable) {
            Log.w(LegacyMigrationConstants.LOG_TAG, "Tink AEAD decrypt failed for encrypted_pin", t)
            return null
        }
        return try {
            String(plaintext, Charsets.UTF_8)
        } finally {
            plaintext.fill(0)
        }
    }
}
