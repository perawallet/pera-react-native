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
package com.algorand.perarn.migration.fixtures

import android.content.Context
import android.util.Base64
import com.algorand.perarn.migration.bridge.LegacyMigrationConstants
import com.algorand.perarn.migration.encryption.TinkAeadProvider
import org.json.JSONArray
import org.json.JSONObject

internal object FixturesPreSixxAccounts {

    fun apply(context: Context) {
        val prefs = context.getSharedPreferences(
            LegacyMigrationConstants.SETTINGS_PREFS_FILE,
            Context.MODE_PRIVATE,
        )
        val plaintext = buildBlobJson().toByteArray(Charsets.UTF_8)
        val ciphertext = try {
            TinkAeadProvider.open(context).encrypt(plaintext, null)
        } finally {
            plaintext.fill(0)
        }
        val encoded = Base64.encodeToString(ciphertext, Base64.DEFAULT)
        // commit() (synchronous) so the prefs file is on disk before the bridge
        // resolves — hasLegacyData() reads the file, and a pre-6.x-only run has
        // no DB to fall back on.
        prefs.edit().putString(KEY_ALGORAND_ACCOUNTS, encoded).commit()
    }

    private fun buildBlobJson(): String =
        JSONArray()
            .put(standardAccount())
            .put(watchAccount())
            .put(preThreeZeroTwoAccount())
            .toString()

    private fun standardAccount(): JSONObject =
        JSONObject().apply {
            put("type", "STANDARD")
            put("publicKey", STANDARD_ADDRESS)
            put("accountName", "Pre-6.x Standard")
            put("isBackedUp", true)
            put("index", "0")
            put(
                "detail",
                JSONObject().apply {
                    put("secretKey", signedIntArray(hexToBytes(STANDARD_SK64_HEX)))
                },
            )
        }

    private fun watchAccount(): JSONObject =
        JSONObject().apply {
            put("type", "WATCH")
            put("publicKey", WATCH_ADDRESS)
            put("accountName", "Pre-6.x Watch")
            put("isBackedUp", true)
            put("index", "1")
            put("detail", JSONObject())
        }

    // No `type` + a root-level `secretKey` is the pre-3.0.2 shape; the reader
    // falls back to treating it as a standard account.
    private fun preThreeZeroTwoAccount(): JSONObject =
        JSONObject().apply {
            put("publicKey", PRE_302_ADDRESS)
            put("accountName", "Pre-3.0.2 Standard")
            put("isBackedUp", false)
            put("secretKey", signedIntArray(hexToBytes(PRE_302_SK64_HEX)))
        }

    private fun signedIntArray(bytes: ByteArray): JSONArray {
        val arr = JSONArray()
        for (b in bytes) arr.put(b.toInt())
        return arr
    }

    private fun hexToBytes(hex: String): ByteArray {
        require(hex.length % 2 == 0) { "hex string must have even length: ${hex.length}" }
        val out = ByteArray(hex.length / 2)
        for (i in out.indices) {
            val hi = Character.digit(hex[i * 2], 16)
            val lo = Character.digit(hex[i * 2 + 1], 16)
            require(hi >= 0 && lo >= 0) { "invalid hex at index ${i * 2}" }
            out[i] = ((hi shl 4) or lo).toByte()
        }
        return out
    }

    private const val KEY_ALGORAND_ACCOUNTS = "algorand_accounts"

    // Deterministic keypairs derived from fixed seeds, intentionally distinct
    // from the address_database fixtures so these accounts are appended rather
    // than deduped away (post-6.x rows win on address conflict).
    private const val STANDARD_ADDRESS =
        "XY7MVEY2J6O45SQTND4MDIG7PXVL3HNJ4SLXC74RDSNYQLCIRCUSDUXOFA"
    private const val STANDARD_SK64_HEX =
        "6d6967726174696f6e2d73696d756c61746f722d707265736978782d73746430be3eca931a4f9dceca1368f8c1a0df7deabd9da9e497717f911c9b882c4888a9"
    private const val WATCH_ADDRESS =
        "LFPJSIWTIEAHNTZWG7V3C7P4GBIJQ5GODNZSYZQULE4TKNFJIMXBUZHXHQ"
    private const val PRE_302_ADDRESS =
        "E7ZA3NGPR75BTMBM733CJLNVEJYPPGPMFCRCOUJ5NEA4JCKDXNUHSAKQGY"
    private const val PRE_302_SK64_HEX =
        "6d6967726174696f6e2d73696d756c61746f722d707265736978782d7033303227f20db4cf8ffa19b02cfef624adb52270f799ec28a227513d6901c48943bb68"
}
