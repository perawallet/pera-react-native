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

internal object FixturesSharedPrefs {

    private const val PIN_DIGITS = "123456"
    private const val LOCK_ATTEMPT_COUNT = 2
    private const val LOCK_PENALTY_REMAINING_MS = 30_000L

    fun applyAuthState(context: Context, includeAuthState: Boolean) {
        val prefs = context.getSharedPreferences(
            LegacyMigrationConstants.SETTINGS_PREFS_FILE,
            Context.MODE_PRIVATE,
        )
        val editor = prefs.edit()
        // Device identifiers, incl. notification_user_id — the source of both
        // the notificationUserId and legacyFallbackDeviceId bridge fields.
        editor.putString("mainnet_device_id", FixtureIdentities.MAINNET_DEVICE_ID)
        editor.putString("testnet_device_id", FixtureIdentities.TESTNET_DEVICE_ID)
        editor.putString("notification_user_id", FixtureIdentities.NOTIFICATION_USER_ID)
        if (includeAuthState) {
            editor.remove("lock_password")
            editor.putString("encrypted_pin", encryptPin(context, PIN_DIGITS))
            editor.putBoolean("use_biometric", true)
            editor.putInt("lock_attempt_count", LOCK_ATTEMPT_COUNT)
            editor.putLong("lock_penalty_remaining", LOCK_PENALTY_REMAINING_MS)
        } else {
            editor.remove("lock_password")
            editor.remove("encrypted_pin")
            editor.remove("use_biometric")
            editor.remove("lock_attempt_count")
            editor.remove("lock_penalty_remaining")
        }
        editor.apply()
    }

    private fun encryptPin(context: Context, pin: String): String {
        val ciphertext = TinkAeadProvider.open(context)
            .encrypt(pin.toByteArray(Charsets.UTF_8), null)
        return Base64.encodeToString(ciphertext, Base64.DEFAULT)
    }
}
