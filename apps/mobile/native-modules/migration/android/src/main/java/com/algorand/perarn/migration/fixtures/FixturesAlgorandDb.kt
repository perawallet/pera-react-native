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

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase

internal object FixturesAlgorandDb {

    fun insert(db: SQLiteDatabase, version: Int) {
        insertNodeRow(db)
        insertContacts(db)
        if (version >= 6) insertNotificationFilters(db)
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
}
