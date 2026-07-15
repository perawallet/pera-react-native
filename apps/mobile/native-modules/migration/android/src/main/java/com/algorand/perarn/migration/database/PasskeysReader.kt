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
package com.algorand.perarn.migration.database

import android.content.Context
import com.algorand.perarn.migration.bridge.LegacyMigrationConstants

internal data class PasskeyRow(
    val credentialId: String,
    val address: String,
    val userId: String?,
    val userName: String?,
    val userDisplayName: String?,
    val lastUsedAtMs: Long?,
    val siteUrl: String,
    val siteName: String?,
)

internal class PasskeysReader(private val context: Context) {

    fun readPasskeys(): List<PasskeyRow> =
        context.openLegacyDatabaseReadOnly(LegacyMigrationConstants.PASSKEY_DB_NAME) { db ->
            val rows = ArrayList<PasskeyRow>()
            db.rawQuery(
                "SELECT p.credential_id, p.bip44_address, p.user_id, p.user_name, " +
                    "p.user_display_name, p.last_used_time_ms, s.url, s.name " +
                    "FROM passkey_table p JOIN sites s ON p.site_id = s.id",
                null,
            ).use { c ->
                while (c.moveToNext()) {
                    val credentialId = c.optString("credential_id") ?: continue
                    val address = c.optString("bip44_address") ?: continue
                    val siteUrl = c.optString("url") ?: continue
                    rows += PasskeyRow(
                        credentialId = credentialId,
                        address = address,
                        userId = c.optString("user_id"),
                        userName = c.optString("user_name"),
                        userDisplayName = c.optString("user_display_name"),
                        lastUsedAtMs = c.optLong("last_used_time_ms"),
                        siteUrl = siteUrl,
                        siteName = c.optString("name"),
                    )
                }
            }
            rows
        }.orEmpty()
}
