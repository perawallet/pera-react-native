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
import com.algorand.perarn.migration.encryption.TinkAeadProvider
import org.json.JSONArray
import org.json.JSONObject

internal sealed interface PreSixxAccountRow {
    val address: String
    val name: String
    val isBackedUp: Boolean
    val index: Int

    data class Standard(
        override val address: String,
        override val name: String,
        override val isBackedUp: Boolean,
        override val index: Int,
        val secretKey: ByteArray?,
    ) : PreSixxAccountRow

    data class Ledger(
        override val address: String,
        override val name: String,
        override val isBackedUp: Boolean,
        override val index: Int,
        val bluetoothAddress: String,
        val bluetoothName: String?,
        val positionInLedger: Int,
    ) : PreSixxAccountRow

    data class Watch(
        override val address: String,
        override val name: String,
        override val isBackedUp: Boolean,
        override val index: Int,
    ) : PreSixxAccountRow
}

internal class LegacyAccountsBlobReader(
    private val prefs: SharedPreferences,
    private val context: Context,
) {

    fun read(): List<PreSixxAccountRow> {
        val ciphertextBase64 = prefs.optString(KEY_ALGORAND_ACCOUNTS) ?: return emptyList()
        val plaintext = decryptBlob(ciphertextBase64) ?: return emptyList()
        val arr = try {
            JSONArray(plaintext)
        } catch (t: Throwable) {
            return emptyList()
        }
        val out = ArrayList<PreSixxAccountRow>(arr.length())
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            val row = try {
                parseAccount(obj)
            } catch (t: Throwable) {
                null
            }
            if (row != null) out.add(row)
        }
        return out
    }

    private fun decryptBlob(ciphertextBase64: String): String? {
        val ciphertext = try {
            Base64.decode(ciphertextBase64, Base64.DEFAULT)
        } catch (t: Throwable) {
            return null
        }
        val plaintext = try {
            TinkAeadProvider.open(context).decrypt(ciphertext, null)
        } catch (t: Throwable) {
            return null
        }
        return try {
            String(plaintext, Charsets.UTF_8)
        } finally {
            plaintext.fill(0)
        }
    }

    private fun parseAccount(obj: JSONObject): PreSixxAccountRow? {
        val address = obj.optStringOrNull("publicKey")
        if (address == null || !ADDRESS_RE.matches(address)) return null

        val name = obj.optStringOrNull("accountName").orEmpty()
        val isBackedUp = if (obj.has("isBackedUp")) obj.optBoolean("isBackedUp", true) else true
        val index = when {
            !obj.has("index") || obj.isNull("index") -> -1
            else -> obj.optString("index", "").toIntOrNull() ?: -1
        }

        val type = obj.optStringOrNull("type")
        val detail = obj.optJSONObject("detail")

        return when (type) {
            "STANDARD" -> PreSixxAccountRow.Standard(
                address, name, isBackedUp, index,
                secretKey = detail?.let { readSecretKey(it, "secretKey") },
            )
            "LEDGER" -> parseLedger(address, name, isBackedUp, index, detail)
            // REKEYED collapses to Standard; rekey relationship is chain-derived.
            "REKEYED" -> PreSixxAccountRow.Standard(
                address, name, isBackedUp, index,
                secretKey = detail?.let { readSecretKey(it, "secretKey") },
            )
            "REKEYED_AUTH" -> parseRekeyedAuth(address, name, isBackedUp, index, detail)
            "WATCH" -> PreSixxAccountRow.Watch(address, name, isBackedUp, index)
            // Missing/unknown type → pre-3.0.2 fallback: root-level secretKey.
            else -> readSecretKey(obj, "secretKey")?.let {
                PreSixxAccountRow.Standard(address, name, isBackedUp, index, secretKey = it)
            }
        }
    }

    private fun parseLedger(
        address: String,
        name: String,
        isBackedUp: Boolean,
        index: Int,
        detail: JSONObject?,
    ): PreSixxAccountRow.Ledger? {
        val bluetoothAddress = detail?.optStringOrNull("bluetoothAddress") ?: return null
        return PreSixxAccountRow.Ledger(
            address = address,
            name = name,
            isBackedUp = isBackedUp,
            index = index,
            bluetoothAddress = bluetoothAddress,
            bluetoothName = detail.optStringOrNull("bluetoothName"),
            positionInLedger = detail.optInt("positionInLedger", 0),
        )
    }

    private fun parseRekeyedAuth(
        address: String,
        name: String,
        isBackedUp: Boolean,
        index: Int,
        detail: JSONObject?,
    ): PreSixxAccountRow? {
        if (detail == null) return null
        val authDetail = detail.optJSONObject("authDetail")
        return when (detail.optStringOrNull("authDetailType")) {
            "STANDARD" -> PreSixxAccountRow.Standard(
                address, name, isBackedUp, index,
                secretKey = authDetail?.let { readSecretKey(it, "secretKey") },
            )
            "LEDGER" -> parseLedger(address, name, isBackedUp, index, authDetail)
            else -> null
        }
    }

    private fun readSecretKey(obj: JSONObject, key: String): ByteArray? {
        if (!obj.has(key) || obj.isNull(key)) return null
        val arr = obj.optJSONArray(key) ?: return null
        return try {
            ByteArray(arr.length()) { (arr.getInt(it) and 0xFF).toByte() }
        } catch (t: Throwable) {
            null
        }
    }

    private fun JSONObject.optStringOrNull(key: String): String? {
        if (!has(key) || isNull(key)) return null
        return optString(key, "").ifEmpty { null }
    }

    private companion object {
        const val KEY_ALGORAND_ACCOUNTS = "algorand_accounts"
        val ADDRESS_RE = Regex("^[A-Z2-7]{58}$")
    }
}
