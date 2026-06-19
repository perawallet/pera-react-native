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

internal object AlgorandDbBaselineV3 {
    val DDL: List<String> = listOf(
        """
        CREATE TABLE IF NOT EXISTS Node (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            name TEXT NOT NULL,
            indexer_address TEXT NOT NULL,
            indexer_api_key TEXT NOT NULL,
            algod_address TEXT NOT NULL,
            algod_api_key TEXT NOT NULL,
            is_active INTEGER NOT NULL,
            is_added_default INTEGER NOT NULL
        )
        """.trimIndent(),
        """
        CREATE TABLE IF NOT EXISTS User (
            name TEXT,
            public_key TEXT NOT NULL,
            uri TEXT,
            PRIMARY KEY(public_key)
        )
        """.trimIndent(),
    )
}
