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
package com.algorand.perarn.migration.fixtures

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase

internal object FixturesAlgorandDb {

    fun insert(db: SQLiteDatabase, version: Int) {
        insertNodeRow(db)
        insertContacts(db)
        if (version >= 6) insertNotificationFilters(db)
        if (version >= 7) insertWalletConnectSessions(db, version)
        if (version in 7..9) insertWalletConnectSessionHistory(db, version)
        if (version >= 10) insertWalletConnectSessionAccounts(db)
    }

    private fun insertNodeRow(db: SQLiteDatabase) {
        db.insert(
            "Node",
            null,
            ContentValues().apply {
                put("name", "MainNet")
                put("indexer_address", "https://mainnet-idx.algonode.cloud")
                put("indexer_api_key", "")
                put("algod_address", "https://mainnet-api.algonode.cloud")
                put("algod_api_key", "")
                put("is_active", 1)
                put("is_added_default", 1)
                put("network_slug", "mainnet")
            },
        )
    }

    private fun insertContacts(db: SQLiteDatabase) {
        contact(db, "Alice", FixtureCrypto.EXTERNAL_PARTICIPANT_ADDRESS, null)
        contact(db, "Bob", FixtureCrypto.WATCH_1_ADDRESS, null)
    }

    private fun contact(db: SQLiteDatabase, name: String, address: String, uri: String?) {
        db.insert(
            "User",
            null,
            ContentValues().apply {
                put("name", name)
                put("public_key", address)
                if (uri == null) putNull("uri") else put("uri", uri)
            },
        )
    }

    private fun insertNotificationFilters(db: SQLiteDatabase) {
        notificationFilter(db, FixtureIdentities.ALGO25_VALID_ADDRESS)
        notificationFilter(db, FixtureIdentities.HD_KEY_0_ADDRESS)
    }

    private fun notificationFilter(db: SQLiteDatabase, publicKey: String) {
        db.insert(
            "NotificationFilter",
            null,
            ContentValues().apply { put("public_key", publicKey) },
        )
    }

    private fun insertWalletConnectSessions(db: SQLiteDatabase, version: Int) {
        wcSession(
            db,
            version = version,
            id = FixtureIdentities.WC_V1_SESSION_VALID_ID,
            peerMeta = """{"name":"Test dApp","url":"https://example.com","description":"Fixture peer","icons":["https://example.com/icon.png"]}""",
            wcSession = """{"connected":true,"accounts":["${FixtureIdentities.ALGO25_VALID_ADDRESS}"],"bridge":"https://bridge.walletconnect.org","key":"abcd1234"}""",
            isConnected = true,
            fallbackBrowserGroupResponse = "chrome",
            isSubscribed = true,
        )
        wcSession(
            db,
            version = version,
            id = FixtureIdentities.WC_V1_SESSION_DISCONNECTED_ID,
            peerMeta = """{"name":"Idle dApp","url":"https://idle.example.com","description":"","icons":[]}""",
            wcSession = """{"connected":false}""",
            isConnected = false,
            fallbackBrowserGroupResponse = null,
            isSubscribed = false,
        )
    }

    private fun wcSession(
        db: SQLiteDatabase,
        version: Int,
        id: Long,
        peerMeta: String,
        wcSession: String,
        isConnected: Boolean,
        fallbackBrowserGroupResponse: String?,
        isSubscribed: Boolean,
    ) {
        db.insert(
            "WalletConnectSessionEntity",
            null,
            ContentValues().apply {
                put("id", id)
                put("peer_meta", peerMeta)
                put("wc_session", wcSession)
                put("date_time_stamp", System.currentTimeMillis())
                put("is_connected", if (isConnected) 1 else 0)
                if (version < 10) {
                    put(
                        "connected_account_public_key",
                        FixtureIdentities.ALGO25_VALID_ADDRESS,
                    )
                }
                if (version >= 9) {
                    if (fallbackBrowserGroupResponse == null) {
                        putNull("fallback_browser_group_response")
                    } else {
                        put("fallback_browser_group_response", fallbackBrowserGroupResponse)
                    }
                }
                if (version >= 11) {
                    put("is_subscribed", if (isSubscribed) 1 else 0)
                }
            },
        )
    }

    private fun insertWalletConnectSessionHistory(db: SQLiteDatabase, version: Int) {
        db.insert(
            "WalletConnectSessionHistoryEntity",
            null,
            ContentValues().apply {
                put("id", 100L)
                put("peer_meta", """{"name":"Old Session","url":"https://old.example.com"}""")
                put("wc_session", """{}""")
                put("creation_date_time_stamp", System.currentTimeMillis() - 86_400_000L)
                put("connected_account_public_key", FixtureIdentities.HD_KEY_0_ADDRESS)
                if (version >= 9) {
                    putNull("fallback_browser_group_response")
                }
            },
        )
    }

    private fun insertWalletConnectSessionAccounts(db: SQLiteDatabase) {
        db.insert(
            "WalletConnectSessionAccountEntity",
            null,
            ContentValues().apply {
                put("session_id", FixtureIdentities.WC_V1_SESSION_VALID_ID)
                put("connected_account_address", FixtureIdentities.ALGO25_VALID_ADDRESS)
            },
        )
        db.insert(
            "WalletConnectSessionAccountEntity",
            null,
            ContentValues().apply {
                put("session_id", FixtureIdentities.WC_V1_SESSION_VALID_ID)
                put("connected_account_address", FixtureIdentities.HD_KEY_0_ADDRESS)
            },
        )
    }
}
