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
package com.algorand.perarn.migration.database

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import com.algorand.perarn.migration.bridge.LegacyMigrationConstants

internal data class WalletConnectV1SessionRow(
    val id: String,
    val peerMetaJson: String,
    val sessionMetaJson: String,
    val dateTimestampMs: Long,
    val isConnected: Boolean,
    val isSubscribed: Boolean,
    val fallbackBrowserGroupResponse: String?,
    val connectedAccounts: List<String>,
)

internal data class WalletConnectV2SessionRow(
    val topic: String,
    val dateTimestampMs: Long,
    val isSubscribed: Boolean,
    val fallbackBrowserGroupResponse: String?,
)

internal class WalletConnectReader(
    private val context: Context,
    private val coordinator: SchemaMigrationCoordinator,
) {

    fun readV1Sessions(): List<WalletConnectV1SessionRow> =
        openLegacyDatabaseReadOnly(coordinator, AlgorandDbMigrations.PLAN) { db ->
            val sessions = ArrayList<WalletConnectV1SessionRow>()
            db.rawQuery(
                "SELECT id, peer_meta, wc_session, date_time_stamp, is_connected, " +
                    "is_subscribed, fallback_browser_group_response FROM WalletConnectSessionEntity",
                null,
            ).use { c ->
                while (c.moveToNext()) {
                    val id = c.optLong("id")?.toString() ?: continue
                    sessions += WalletConnectV1SessionRow(
                        id = id,
                        peerMetaJson = c.optString("peer_meta").orEmpty(),
                        sessionMetaJson = c.optString("wc_session").orEmpty(),
                        dateTimestampMs = c.optLong("date_time_stamp") ?: 0L,
                        isConnected = c.optInt("is_connected") != 0,
                        isSubscribed = c.optInt("is_subscribed") != 0,
                        fallbackBrowserGroupResponse = c.optString("fallback_browser_group_response"),
                        connectedAccounts = readConnectedAccounts(db, id),
                    )
                }
            }
            sessions
        }.orEmpty()

    fun readV2Sessions(): List<WalletConnectV2SessionRow> =
        context.openLegacyDatabaseReadOnly(LegacyMigrationConstants.WALLET_CONNECT_V2_DB_NAME) { db ->
            val rows = ArrayList<WalletConnectV2SessionRow>()
            db.rawQuery(
                "SELECT topic, date_time_stamp, is_subscribed, fallback_browser_group_response " +
                    "FROM WalletConnectV2SessionEntity",
                null,
            ).use { c ->
                while (c.moveToNext()) {
                    val topic = c.optString("topic") ?: continue
                    rows += WalletConnectV2SessionRow(
                        topic = topic,
                        dateTimestampMs = c.optLong("date_time_stamp") ?: 0L,
                        isSubscribed = c.optInt("is_subscribed") != 0,
                        fallbackBrowserGroupResponse = c.optString("fallback_browser_group_response"),
                    )
                }
            }
            rows
        }.orEmpty()

    // session_id is bound as String; SQLite INTEGER affinity coerces the TEXT param to INTEGER for comparison.
    private fun readConnectedAccounts(db: SQLiteDatabase, sessionId: String): List<String> {
        val out = ArrayList<String>()
        db.rawQuery(
            "SELECT connected_account_address FROM WalletConnectSessionAccountEntity " +
                "WHERE session_id = ?",
            arrayOf(sessionId),
        ).use { c ->
            while (c.moveToNext()) {
                c.optString("connected_account_address")?.let { out += it }
            }
        }
        return out
    }
}
