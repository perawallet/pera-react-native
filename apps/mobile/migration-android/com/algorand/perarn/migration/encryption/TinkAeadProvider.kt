/*
 * Copyright 2022-2025 Pera Wallet, LDA
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

import android.content.Context
import com.algorand.perarn.migration.bridge.LegacyMigrationConstants
import com.google.crypto.tink.Aead
import com.google.crypto.tink.KeyTemplates
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.integration.android.AndroidKeysetManager

internal object TinkAeadProvider {
    fun open(context: Context): Aead {
        AeadConfig.register()
        return AndroidKeysetManager.Builder()
            .withSharedPref(
                context,
                LegacyMigrationConstants.TINK_KEYSET_NAME,
                LegacyMigrationConstants.TINK_KEYSET_PREFS_FILE,
            )
            .withKeyTemplate(KeyTemplates.get("AES256_GCM"))
            .withMasterKeyUri(LegacyMigrationConstants.KEYSTORE_MASTER_KEY_URI)
            .build()
            .keysetHandle
            .getPrimitive(Aead::class.java)
    }
}
