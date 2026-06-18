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

internal object PeraDbBaselineV1 {
    val DDL: List<String> = listOf(
        """
        CREATE TABLE IF NOT EXISTS custom_account_info (
            algo_address TEXT NOT NULL,
            custom_name TEXT,
            order_index INTEGER NOT NULL,
            is_backed_up INTEGER NOT NULL,
            PRIMARY KEY(algo_address)
        )
        """.trimIndent(),
        """
        CREATE TABLE IF NOT EXISTS custom_hd_seed_info (
            seed_id INTEGER NOT NULL,
            entropy_custom_name TEXT,
            order_index INTEGER NOT NULL,
            is_backed_up INTEGER NOT NULL,
            PRIMARY KEY(seed_id)
        )
        """.trimIndent(),
        """
        CREATE TABLE IF NOT EXISTS account_information (
            algo_address TEXT NOT NULL,
            PRIMARY KEY(algo_address)
        )
        """.trimIndent(),
        """
        CREATE TABLE IF NOT EXISTS asset_holding_table (
            algo_address TEXT NOT NULL,
            asset_id INTEGER NOT NULL,
            PRIMARY KEY(algo_address, asset_id)
        )
        """.trimIndent(),
        """
        CREATE TABLE IF NOT EXISTS collectible (
            collectible_asset_id INTEGER NOT NULL,
            PRIMARY KEY (collectible_asset_id)
        )
        """.trimIndent(),
        """
        CREATE TABLE IF NOT EXISTS asset_detail (
            id INTEGER NOT NULL,
            PRIMARY KEY(id)
        )
        """.trimIndent(),
    )
}
