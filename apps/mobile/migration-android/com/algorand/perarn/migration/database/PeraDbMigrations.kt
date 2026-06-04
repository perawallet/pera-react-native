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

import com.algorand.perarn.migration.bridge.LegacyMigrationConstants

internal object PeraDbMigrations {

    private val MIGRATION_1_2 = BundledMigration(
        from = 1,
        to = 2,
        description = "Started caching each account's minimum required balance. " +
            "Doesn't change anything we bring over — we apply this update " +
            "so the local database matches what newer Pera versions expect.",
        sql = listOf(
            "ALTER TABLE account_information ADD COLUMN min_required_balance TEXT NOT NULL DEFAULT '0'",
        ),
    )

    private val MIGRATION_2_3 = BundledMigration(
        from = 2,
        to = 3,
        description = "Started counting how many assets each account opted into. " +
            "Doesn't change anything we bring over.",
        sql = listOf(
            "ALTER TABLE account_information ADD COLUMN opted_in_assets_count INTEGER NOT NULL DEFAULT 0",
        ),
    )

    private val MIGRATION_3_4 = BundledMigration(
        from = 3,
        to = 4,
        description = "Rebuilt the cached lists of asset balances and collectibles " +
            "(NFTs). Doesn't change anything we bring over.",
        sql = listOf(
            "DROP TABLE IF EXISTS `collectible`",
            """
            CREATE TABLE IF NOT EXISTS collectible (
                collectible_asset_id INTEGER NOT NULL,
                standard_type TEXT,
                media_type TEXT,
                primary_image_url TEXT,
                title TEXT,
                description TEXT,
                collection_id INTEGER,
                collection_name TEXT,
                collection_description TEXT,
                PRIMARY KEY (collectible_asset_id)
            )
            """.trimIndent(),
            """
            CREATE UNIQUE INDEX IF NOT EXISTS index_collectible_collectible_asset_id
            ON collectible(collectible_asset_id)
            """.trimIndent(),
            "DROP TABLE IF EXISTS `asset_holding_table`",
            """
            CREATE TABLE IF NOT EXISTS asset_holding_table (
                algo_address TEXT NOT NULL,
                asset_id INTEGER NOT NULL,
                amount TEXT NOT NULL,
                is_deleted INTEGER NOT NULL,
                is_frozen INTEGER NOT NULL,
                opted_in_at_round INTEGER,
                opted_out_at_round INTEGER,
                asset_status TEXT NOT NULL,
                PRIMARY KEY(algo_address, asset_id)
            )
            """.trimIndent(),
            """
            CREATE UNIQUE INDEX IF NOT EXISTS index_asset_holding_table_algo_address_asset_id
            ON `asset_holding_table` (`algo_address`, `asset_id`)
            """.trimIndent(),
        ),
    )

    private val MIGRATION_4_5 = BundledMigration(
        from = 4,
        to = 5,
        description = "Started tagging assets with a category. Doesn't change " +
            "anything we bring over.",
        sql = listOf(
            "ALTER TABLE asset_detail ADD COLUMN category TEXT",
        ),
    )

    private val MIGRATION_5_6 = BundledMigration(
        from = 5,
        to = 6,
        description = "Added favorite assets and per-asset price alerts. Doesn't " +
            "change anything we bring over.",
        sql = listOf(
            "ALTER TABLE asset_detail ADD COLUMN is_favorite INTEGER",
            "ALTER TABLE asset_detail ADD COLUMN is_price_alert_enabled INTEGER",
        ),
    )

    val PLAN = MigrationPlan(
        dbName = LegacyMigrationConstants.PERA_DB_NAME,
        targetVersion = 6,
        oldestSupported = 1,
        readerImpact = "Holds per-account display names, custom ordering, and " +
            "'backed up' flags, plus the name shown for each HD wallet. " +
            "Nothing we bring over depends on the changes below — we still " +
            "apply them so the local database matches what newer Pera " +
            "versions expect.",
        migrations = listOf(
            MIGRATION_1_2,
            MIGRATION_2_3,
            MIGRATION_3_4,
            MIGRATION_4_5,
            MIGRATION_5_6,
        ),
    )
}
