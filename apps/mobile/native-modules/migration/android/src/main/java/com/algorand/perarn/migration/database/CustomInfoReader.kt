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


internal data class CustomAccountInfoRow(
    val address: String,
    val name: String?,
    val orderIndex: Int,
    val isBackedUp: Boolean,
)

internal data class CustomHdSeedInfoRow(
    val seedId: String,
    val name: String?,
    val orderIndex: Int,
    val isBackedUp: Boolean,
)

internal class CustomInfoReader(
    private val coordinator: SchemaMigrationCoordinator,
) {

    fun readAccountInfo(): Map<String, CustomAccountInfoRow> =
        openLegacyDatabaseReadOnly(coordinator, PeraDbMigrations.PLAN) { db ->
            val rows = HashMap<String, CustomAccountInfoRow>()
            db.rawQuery(
                "SELECT $COLUMN_ALGO_ADDRESS, $COLUMN_CUSTOM_NAME, $COLUMN_ORDER_INDEX, $COLUMN_IS_BACKED_UP FROM custom_account_info",
                null,
            ).use { c ->
                while (c.moveToNext()) {
                    val address = c.optString(COLUMN_ALGO_ADDRESS) ?: continue
                    rows[address] = CustomAccountInfoRow(
                        address = address,
                        name = c.optString(COLUMN_CUSTOM_NAME),
                        orderIndex = c.optInt(COLUMN_ORDER_INDEX) ?: -1,
                        isBackedUp = (c.optInt(COLUMN_IS_BACKED_UP) ?: 0) != 0,
                    )
                }
            }
            rows
        }.orEmpty()

    fun readHdSeedInfo(): Map<String, CustomHdSeedInfoRow> =
        openLegacyDatabaseReadOnly(coordinator, PeraDbMigrations.PLAN) { db ->
            val rows = HashMap<String, CustomHdSeedInfoRow>()
            db.rawQuery(
                "SELECT $COLUMN_SEED_ID, $COLUMN_ENTROPY_CUSTOM_NAME, $COLUMN_ORDER_INDEX, $COLUMN_IS_BACKED_UP FROM custom_hd_seed_info",
                null,
            ).use { c ->
                while (c.moveToNext()) {
                    val seedId = c.optInt(COLUMN_SEED_ID)?.toString() ?: continue
                    rows[seedId] = CustomHdSeedInfoRow(
                        seedId = seedId,
                        name = c.optString(COLUMN_ENTROPY_CUSTOM_NAME),
                        orderIndex = c.optInt(COLUMN_ORDER_INDEX) ?: -1,
                        isBackedUp = (c.optInt(COLUMN_IS_BACKED_UP) ?: 0) != 0,
                    )
                }
            }
            rows
        }.orEmpty()

    private companion object {
        const val COLUMN_ALGO_ADDRESS = "algo_address"
        const val COLUMN_CUSTOM_NAME = "custom_name"
        const val COLUMN_SEED_ID = "seed_id"
        const val COLUMN_ENTROPY_CUSTOM_NAME = "entropy_custom_name"
        const val COLUMN_ORDER_INDEX = "order_index"
        const val COLUMN_IS_BACKED_UP = "is_backed_up"
    }
}
