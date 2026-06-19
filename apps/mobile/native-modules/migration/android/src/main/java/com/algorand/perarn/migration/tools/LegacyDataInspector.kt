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
import com.algorand.perarn.migration.bridge.LegacyMigrationConstants
import java.io.File

internal class LegacyDataInspector(private val context: Context) {

    fun hasLegacyData(): Boolean {
        return hasSettingsPrefs() || hasAnyLegacyDb()
    }

    private fun hasSettingsPrefs(): Boolean {
        val prefsFile = sharedPrefsFile(LegacyMigrationConstants.SETTINGS_PREFS_FILE)
        if (!prefsFile.exists() || prefsFile.length() == 0L) return false

        return try {
            val prefs = context.getSharedPreferences(
                LegacyMigrationConstants.SETTINGS_PREFS_FILE,
                Context.MODE_PRIVATE,
            )
            prefs.all.isNotEmpty()
        } catch (_: Throwable) {
            true
        }
    }

    private fun hasAnyLegacyDb(): Boolean =
        LegacyMigrationConstants.LEGACY_DATABASE_FILES.any { name ->
            context.getDatabasePath(name).exists()
        }

    private fun sharedPrefsFile(name: String): File =
        File(context.applicationInfo.dataDir, "shared_prefs/$name.xml")
}
