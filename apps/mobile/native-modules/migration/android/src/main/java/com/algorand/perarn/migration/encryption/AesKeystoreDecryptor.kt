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
package com.algorand.perarn.migration.encryption

import android.security.keystore.KeyProperties
import android.util.Log
import com.algorand.perarn.migration.bridge.LegacyMigrationConstants
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// Decrypts legacy AES/GCM DB blobs. Prefers StrongBox alias. Blob layout: [12B IV][ciphertext + 16B GCM tag].
internal class AesKeystoreDecryptor {

    private val key: SecretKey? by lazy {
        try {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
            val alias = when {
                keyStore.containsAlias(STRONG_BOX_ALIAS) -> STRONG_BOX_ALIAS
                keyStore.containsAlias(KEY_ALIAS) -> KEY_ALIAS
                else -> {
                    Log.w(
                        LegacyMigrationConstants.LOG_TAG,
                        "Neither $STRONG_BOX_ALIAS nor $KEY_ALIAS exists in AndroidKeyStore — encrypted DB blobs will surface as null",
                    )
                    return@lazy null
                }
            }
            keyStore.getKey(alias, null) as? SecretKey
        } catch (t: Throwable) {
            Log.w(LegacyMigrationConstants.LOG_TAG, "AES key lookup failed; encrypted DB blobs will surface as null", t)
            null
        }
    }

    fun decryptOrNull(blob: ByteArray?): ByteArray? {
        if (blob == null || blob.size <= GCM_IV_LENGTH) return null
        val secret = key ?: return null
        return try {
            val iv = blob.copyOfRange(0, GCM_IV_LENGTH)
            val cipherData = blob.copyOfRange(GCM_IV_LENGTH, blob.size)
            val cipher = Cipher.getInstance(AES_MODE)
            cipher.init(Cipher.DECRYPT_MODE, secret, GCMParameterSpec(GCM_TAG_BITS, iv))
            cipher.doFinal(cipherData)
        } catch (t: Throwable) {
            Log.w(LegacyMigrationConstants.LOG_TAG, "Failed to decrypt encrypted DB blob (${blob.size}B)", t)
            null
        }
    }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val KEY_ALIAS = "PeraAESKey"
        const val STRONG_BOX_ALIAS = "${KEY_ALIAS}_strongbox"
        const val AES_MODE = "AES/${KeyProperties.BLOCK_MODE_GCM}/${KeyProperties.ENCRYPTION_PADDING_NONE}"
        const val GCM_IV_LENGTH = 12
        const val GCM_TAG_BITS = 128
    }
}
