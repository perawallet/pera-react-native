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

internal object AddressDbBaselineV1 {
    val DDL: List<String> = listOf(
        """
        CREATE TABLE IF NOT EXISTS hd_seeds (
            seed_id INTEGER NOT NULL,
            encrypted_entropy BLOB,
            PRIMARY KEY(seed_id)
        )
        """.trimIndent(),
        """
        CREATE TABLE IF NOT EXISTS hd_keys (
            algo_address TEXT NOT NULL,
            seed_id INTEGER NOT NULL,
            account INTEGER NOT NULL,
            `change` INTEGER NOT NULL,
            key_index INTEGER NOT NULL,
            derivation_type INTEGER NOT NULL,
            encrypted_private_key BLOB,
            PRIMARY KEY(algo_address)
        )
        """.trimIndent(),
        """
        CREATE TABLE IF NOT EXISTS algo_25 (
            algo_address TEXT NOT NULL,
            encrypted_secret_key BLOB,
            PRIMARY KEY(algo_address)
        )
        """.trimIndent(),
        """
        CREATE TABLE IF NOT EXISTS no_auth (
            algo_address TEXT NOT NULL,
            PRIMARY KEY(algo_address)
        )
        """.trimIndent(),
        """
        CREATE TABLE IF NOT EXISTS ledger_ble (
            algo_address TEXT NOT NULL,
            device_mac_address TEXT,
            bluetooth_name TEXT,
            account_index_in_ledger INTEGER NOT NULL,
            PRIMARY KEY(algo_address)
        )
        """.trimIndent(),
    )
}
