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

import com.algorand.perarn.migration.bridge.LegacyMigrationConstants

internal object AlgorandDbMigrations {

    private val MIGRATION_3_4 = BundledMigration(
        from = 3,
        to = 4,
        description = "Started tagging each saved Algorand node with its network " +
            "(mainnet, testnet, etc.). Doesn't change anything we bring " +
            "over.",
        sql = listOf(
            "ALTER TABLE Node ADD COLUMN networkSlug TEXT NOT NULL DEFAULT ''",
        ),
    )

    private val MIGRATION_4_5 = BundledMigration(
        from = 4,
        to = 5,
        description = "Rebuilt the saved Algorand nodes list with a cleaner layout. " +
            "Doesn't change anything we bring over.",
        sql = listOf(
            "DROP TABLE Node",
            """
            CREATE TABLE Node (
                name TEXT NOT NULL,
                indexer_address TEXT NOT NULL,
                indexer_api_key TEXT NOT NULL,
                algod_address TEXT NOT NULL,
                algod_api_key TEXT NOT NULL,
                is_active INTEGER NOT NULL,
                is_added_default INTEGER NOT NULL,
                network_slug TEXT NOT NULL,
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL
            )
            """.trimIndent(),
        ),
    )

    private val MIGRATION_5_6 = BundledMigration(
        from = 5,
        to = 6,
        description = "Added the per-account notification mute list. Without this " +
            "update, users coming from older versions of the app lose every " +
            "muted-account preference.",
        sql = listOf(
            "CREATE TABLE IF NOT EXISTS NotificationFilter (`public_key` TEXT NOT NULL, PRIMARY KEY(`public_key`))",
        ),
    )

    private val MIGRATION_6_7 = BundledMigration(
        from = 6,
        to = 7,
        description = "Added tracking for active WalletConnect v1 sessions (the " +
            "dApps you're connected to) and a separate history log. " +
            "Without this update, users coming from older versions of the " +
            "app lose every active WalletConnect session.",
        sql = listOf(
            """
            CREATE TABLE IF NOT EXISTS WalletConnectSessionEntity (
                id INTEGER NOT NULL,
                peer_meta TEXT NOT NULL,
                wc_session TEXT NOT NULL,
                date_time_stamp INTEGER NOT NULL,
                connected_account_public_key TEXT NOT NULL,
                is_connected INTEGER NOT NULL,
                PRIMARY KEY(id)
            )
            """.trimIndent(),
            """
            CREATE TABLE IF NOT EXISTS WalletConnectSessionHistoryEntity (
                id INTEGER NOT NULL,
                peer_meta TEXT NOT NULL,
                wc_session TEXT NOT NULL,
                creation_date_time_stamp INTEGER NOT NULL,
                connected_account_public_key TEXT NOT NULL,
                PRIMARY KEY(id)
            )
            """.trimIndent(),
        ),
    )

    private val MIGRATION_7_8 = BundledMigration(
        from = 7,
        to = 8,
        description = "Started storing the mobile Algorand address per saved node. " +
            "Doesn't change anything we bring over.",
        sql = listOf(
            "ALTER TABLE Node ADD COLUMN mobile_algorand_address TEXT NOT NULL DEFAULT ''",
        ),
    )

    private val MIGRATION_8_9 = BundledMigration(
        from = 8,
        to = 9,
        description = "Started recording which mobile browser handled each " +
            "WalletConnect session's deep-link. Without this update, users " +
            "coming from version 8 lose every WalletConnect session.",
        sql = listOf(
            "ALTER TABLE WalletConnectSessionEntity ADD COLUMN fallback_browser_group_response TEXT",
            "ALTER TABLE WalletConnectSessionHistoryEntity ADD COLUMN fallback_browser_group_response TEXT",
        ),
    )

    private val MIGRATION_9_10 = BundledMigration(
        from = 9,
        to = 10,
        description = "Reworked WalletConnect sessions so one session can sign for " +
            "multiple accounts at once. Also retired the separate session " +
            "history log. Without this update, users coming from older " +
            "versions of the app lose the link between sessions and the " +
            "accounts they were connected to.",
        sql = listOf(
            """
            CREATE TABLE IF NOT EXISTS WalletConnectSessionAccountEntity (
                id INTEGER NOT NULL,
                session_id INTEGER NOT NULL,
                connected_account_address TEXT NOT NULL,
                PRIMARY KEY(id),
                FOREIGN KEY(session_id) REFERENCES WalletConnectSessionEntity(id)
                ON DELETE CASCADE
                ON UPDATE CASCADE
            )
            """.trimIndent(),
            """
            INSERT INTO WalletConnectSessionAccountEntity (session_id, connected_account_address)
            SELECT id, connected_account_public_key FROM WalletConnectSessionEntity
            """.trimIndent(),
            """
            CREATE TABLE WalletConnectSessionEntity_backup (
                id INTEGER NOT NULL,
                peer_meta TEXT NOT NULL,
                wc_session TEXT NOT NULL,
                date_time_stamp INTEGER NOT NULL,
                is_connected INTEGER NOT NULL,
                fallback_browser_group_response TEXT,
                PRIMARY KEY(id)
            )
            """.trimIndent(),
            """
            INSERT INTO WalletConnectSessionEntity_backup
            SELECT id, peer_meta, wc_session, date_time_stamp, is_connected, fallback_browser_group_response
            FROM WalletConnectSessionEntity
            """.trimIndent(),
            "DROP TABLE WalletConnectSessionEntity",
            "ALTER TABLE WalletConnectSessionEntity_backup RENAME TO WalletConnectSessionEntity",
            "DROP TABLE WalletConnectSessionHistoryEntity",
        ),
    )

    private val MIGRATION_10_11 = BundledMigration(
        from = 10,
        to = 11,
        description = "Started tracking whether each WalletConnect session is " +
            "subscribed for push events. Without this update, users coming " +
            "from version 10 lose every WalletConnect session.",
        sql = listOf(
            "ALTER TABLE WalletConnectSessionEntity ADD COLUMN is_subscribed INTEGER NOT NULL DEFAULT 0",
        ),
    )

    private val MIGRATION_11_12 = BundledMigration(
        from = 11,
        to = 12,
        description = "Added bookkeeping to prevent duplicate WalletConnect v1 " +
            "requests and transactions. Doesn't change anything we bring " +
            "over.",
        sql = listOf(
            """
            CREATE TABLE IF NOT EXISTS WalletConnectV1SessionRequestIdEntity (
                id INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                PRIMARY KEY(id)
            )
            """.trimIndent(),
            """
            CREATE TABLE IF NOT EXISTS WalletConnectV1TransactionRequestIdEntity (
                id INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                PRIMARY KEY(id)
            )
            """.trimIndent(),
        ),
    )

    val PLAN = MigrationPlan(
        dbName = LegacyMigrationConstants.ALGORAND_DB_NAME,
        targetVersion = 12,
        oldestSupported = 3,
        readerImpact = "Holds the contacts address book, the per-account " +
            "notification mute list, and active WalletConnect v1 sessions " +
            "with the accounts each one is connected to. Users coming from " +
            "very early versions (v1 or v2) can't be brought up to date — " +
            "the original app's earliest two updates aren't included.",
        migrations = listOf(
            MIGRATION_3_4,
            MIGRATION_4_5,
            MIGRATION_5_6,
            MIGRATION_6_7,
            MIGRATION_7_8,
            MIGRATION_8_9,
            MIGRATION_9_10,
            MIGRATION_10_11,
            MIGRATION_11_12,
        ),
    )
}
