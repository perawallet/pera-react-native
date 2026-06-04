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

internal object FixturesPeraDb {

    @Suppress("UNUSED_PARAMETER")
    fun insert(db: SQLiteDatabase, version: Int) {
        insertCustomAccountInfo(db)
        insertCustomHdSeedInfo(db)
    }

    private fun insertCustomAccountInfo(db: SQLiteDatabase) {
        val rows = listOf(
            CustomAccountInfo(FixtureIdentities.HD_KEY_0_ADDRESS, "Main HD Account", 0, true),
            CustomAccountInfo(FixtureIdentities.HD_KEY_1_ADDRESS, "HD Account #2", 1, false),
            CustomAccountInfo(FixtureIdentities.HD_KEY_2_ADDRESS, "HD Account #3", 2, true),
            CustomAccountInfo(FixtureIdentities.ALGO25_VALID_ADDRESS, "Algo25 Imported", 3, true),
            CustomAccountInfo(FixtureIdentities.WATCH_ONLY_1_ADDRESS, "Watching Treasury", 4, false),
            CustomAccountInfo(FixtureIdentities.WATCH_ONLY_2_ADDRESS, "Watching Cold Storage", 5, false),
            CustomAccountInfo(FixtureIdentities.LEDGER_VALID_1_ADDRESS, "Ledger Nano X", 6, true),
        )
        for (row in rows) {
            db.insert(
                "custom_account_info",
                null,
                ContentValues().apply {
                    put("algo_address", row.address)
                    put("custom_name", row.name)
                    put("order_index", row.orderIndex)
                    put("is_backed_up", if (row.isBackedUp) 1 else 0)
                },
            )
        }
    }

    private fun insertCustomHdSeedInfo(db: SQLiteDatabase) {
        db.insert(
            "custom_hd_seed_info",
            null,
            ContentValues().apply {
                put("seed_id", FixtureIdentities.SEED_1_ID)
                put("entropy_custom_name", "Test Seed")
                put("order_index", 0)
                put("is_backed_up", 0)
            },
        )
    }

    private data class CustomAccountInfo(
        val address: String,
        val name: String,
        val orderIndex: Int,
        val isBackedUp: Boolean,
    )
}
