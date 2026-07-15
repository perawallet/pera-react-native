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
import com.algorand.perarn.migration.bridge.LegacyMigrationConstants
import com.facebook.react.bridge.WritableMap

internal class SharedPrefsReader(context: Context) {

    private val prefs = context.getSharedPreferences(LegacyMigrationConstants.SETTINGS_PREFS_FILE, Context.MODE_PRIVATE)

    val preferences = PreferencesReader(prefs)
    val auth = AuthReader(prefs, context)
    val deviceIdentifiers = DeviceIdentifiersReader(prefs)
    val accountsBlob = LegacyAccountsBlobReader(prefs, context)

    data class Result(
        val preferences: WritableMap,
        val auth: WritableMap,
        val deviceIdentifiers: WritableMap,
        val tooltips: WritableMap,
        val dismissedBanners: WritableMap,
    )

    fun read(): Result = Result(
        preferences = preferences.build(),
        auth = auth.build(),
        deviceIdentifiers = deviceIdentifiers.build(),
        tooltips = preferences.buildTooltipPreferences(),
        dismissedBanners = preferences.buildDismissedBanners(),
    )
}
