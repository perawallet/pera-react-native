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
package com.algorand.perarn.migration.tools

import android.content.Context
import android.util.Log
import com.algorand.perarn.migration.bridge.LegacyMigrationConstants
import com.algorand.perarn.migration.database.SchemaMigrationReplay
import java.security.KeyStore

// DESTRUCTIVE: wipes every legacy artifact. Do NOT call from production migration flow.
internal class LegacyDataWiper(private val context: Context) {

    // DEV-ONLY destructive wipe (no production guard) + schema-replay cache. Do not call from app code.
    fun forceClear() {
        wipeEverything()
        SchemaMigrationReplay.cleanupAll(context)
    }

    private fun wipeEverything() {
        clearSharedPrefs(LegacyMigrationConstants.SETTINGS_PREFS_FILE)
        clearSharedPrefs(LegacyMigrationConstants.TINK_KEYSET_PREFS_FILE)
        for (dbName in LegacyMigrationConstants.LEGACY_DATABASE_FILES) {
            deleteDatabase(dbName)
        }
        deleteKeystoreAliases(LegacyMigrationConstants.LEGACY_KEYSTORE_ALIASES)
    }

    private fun clearSharedPrefs(name: String) {
        try {
            context.getSharedPreferences(name, Context.MODE_PRIVATE)
                .edit()
                .clear()
                .commit()
        } catch (t: Throwable) {
            Log.w(LegacyMigrationConstants.LOG_TAG, "Failed to clear SharedPreferences '$name'", t)
        }
    }

    private fun deleteDatabase(dbName: String) {
        try {
            context.deleteDatabase(dbName)
        } catch (t: Throwable) {
            Log.w(LegacyMigrationConstants.LOG_TAG, "Failed to delete database '$dbName'", t)
        }
    }

    private fun deleteKeystoreAliases(aliases: List<String>) {
        try {
            val keystore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            for (alias in aliases) {
                try {
                    if (keystore.containsAlias(alias)) {
                        keystore.deleteEntry(alias)
                    }
                } catch (t: Throwable) {
                    Log.w(LegacyMigrationConstants.LOG_TAG, "Failed to delete Keystore alias '$alias'", t)
                }
            }
        } catch (t: Throwable) {
            Log.w(LegacyMigrationConstants.LOG_TAG, "Failed to open AndroidKeyStore for cleanup", t)
        }
    }
}
