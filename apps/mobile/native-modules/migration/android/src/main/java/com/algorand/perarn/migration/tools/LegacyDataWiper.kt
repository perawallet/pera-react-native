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
package com.algorand.perarn.migration.tools

import android.content.Context
import android.util.Log
import com.algorand.perarn.migration.bridge.LegacyMigrationConstants
import com.algorand.perarn.migration.database.SchemaMigrationReplay
import java.io.File
import java.security.KeyStore

// DESTRUCTIVE: wipes every legacy artifact.
internal class LegacyDataWiper(private val context: Context) {

    // Destructive wipe (no production guard) + schema-replay cache.
    fun forceClear() {
        wipeEverything()
        SchemaMigrationReplay.cleanupAll(context)
    }

    // Post-migration wipe on a live wallet. The databases and settings prefs are what
    // hasLegacyData checks, and the settings prefs go last among them, so a failed or interrupted
    // wipe is still detected and retried while its data can still be decrypted. The decryption
    // keys go only after the ciphertext they protect: left over on their own they expose nothing.
    fun wipeMigrated() {
        val failures = mutableListOf<String>()
        deleteCacheFile(LegacyMigrationConstants.WC_SESSION_STORE_FILE_NAME)
        SchemaMigrationReplay.cleanupAll(context)
        for (dbName in LegacyMigrationConstants.LEGACY_DATABASE_FILES) {
            failures += deleteDatabaseReporting(dbName)
        }
        if (failures.isEmpty()) {
            failures += clearSharedPrefsReporting(LegacyMigrationConstants.SETTINGS_PREFS_FILE)
        }
        if (failures.isEmpty()) {
            failures += clearSharedPrefsReporting(LegacyMigrationConstants.TINK_KEYSET_PREFS_FILE)
            failures += deleteKeystoreAliasesReporting(LegacyMigrationConstants.LEGACY_KEYSTORE_ALIASES)
        }
        check(failures.isEmpty()) { "[Migration:wipe] ${failures.joinToString("; ")}" }
    }

    private fun clearSharedPrefsReporting(name: String): List<String> =
        try {
            val committed = context.getSharedPreferences(name, Context.MODE_PRIVATE)
                .edit()
                .clear()
                .commit()
            if (committed) emptyList() else listOf("clear prefs $name")
        } catch (t: Throwable) {
            Log.w(LegacyMigrationConstants.LOG_TAG, "Failed to clear SharedPreferences '$name'", t)
            listOf("clear prefs $name")
        }

    private fun deleteDatabaseReporting(dbName: String): List<String> =
        try {
            context.deleteDatabase(dbName)
            if (context.getDatabasePath(dbName).exists()) listOf("delete database $dbName") else emptyList()
        } catch (t: Throwable) {
            Log.w(LegacyMigrationConstants.LOG_TAG, "Failed to delete database '$dbName'", t)
            listOf("delete database $dbName")
        }

    private fun deleteKeystoreAliasesReporting(aliases: List<String>): List<String> =
        try {
            val keystore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            aliases.mapNotNull { alias ->
                try {
                    if (keystore.containsAlias(alias)) keystore.deleteEntry(alias)
                    null
                } catch (t: Throwable) {
                    Log.w(LegacyMigrationConstants.LOG_TAG, "Failed to delete Keystore alias '$alias'", t)
                    "delete keystore alias $alias"
                }
            }
        } catch (t: Throwable) {
            Log.w(LegacyMigrationConstants.LOG_TAG, "Failed to open AndroidKeyStore for cleanup", t)
            listOf("open AndroidKeyStore")
        }

    private fun wipeEverything() {
        clearSharedPrefs(LegacyMigrationConstants.SETTINGS_PREFS_FILE)
        clearSharedPrefs(LegacyMigrationConstants.TINK_KEYSET_PREFS_FILE)
        for (dbName in LegacyMigrationConstants.LEGACY_DATABASE_FILES) {
            deleteDatabase(dbName)
        }
        deleteKeystoreAliases(LegacyMigrationConstants.LEGACY_KEYSTORE_ALIASES)
        deleteCacheFile(LegacyMigrationConstants.WC_SESSION_STORE_FILE_NAME)
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

    private fun deleteCacheFile(name: String) {
        try {
            File(context.cacheDir, name).delete()
        } catch (t: Throwable) {
            Log.w(LegacyMigrationConstants.LOG_TAG, "Failed to delete cache file '$name'", t)
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
