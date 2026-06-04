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

internal object AddressDbMigrations {

    private val MIGRATION_1_2 = BundledMigration(
        from = 1,
        to = 2,
        description = "Added support for multisig (joint) accounts. Without this " +
            "update, users coming from older versions of the app lose all " +
            "their multisig accounts.",
        sql = listOf(
            """
            CREATE TABLE IF NOT EXISTS joint_account (
                algo_address TEXT NOT NULL,
                threshold INTEGER NOT NULL,
                version INTEGER NOT NULL,
                PRIMARY KEY(algo_address)
            )
            """.trimIndent(),
            """
            CREATE TABLE IF NOT EXISTS joint_participant (
                joint_address TEXT NOT NULL,
                participant_index INTEGER NOT NULL,
                participant_address TEXT NOT NULL,
                PRIMARY KEY(joint_address, participant_index),
                FOREIGN KEY(joint_address) REFERENCES joint_account(algo_address) ON DELETE CASCADE
            )
            """.trimIndent(),
            """
            CREATE INDEX IF NOT EXISTS index_joint_participant_joint_address
            ON joint_participant(joint_address)
            """.trimIndent(),
        ),
    )

    val PLAN = MigrationPlan(
        dbName = LegacyMigrationConstants.ADDRESS_DB_NAME,
        targetVersion = 2,
        oldestSupported = 1,
        readerImpact = "Holds everything needed to recover each account: HD wallets, " +
            "standard single-account keys, watch-only addresses, paired " +
            "Ledger hardware, and multisig participants. If this database " +
            "can't be read, no accounts come over.",
        migrations = listOf(MIGRATION_1_2),
    )
}
