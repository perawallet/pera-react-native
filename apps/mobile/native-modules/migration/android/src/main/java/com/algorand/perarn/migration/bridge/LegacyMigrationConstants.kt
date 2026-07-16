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
package com.algorand.perarn.migration.bridge

internal object LegacyMigrationConstants {
    const val SCHEMA_VERSION = 1

    const val SETTINGS_PREFS_FILE = "algorand_settings"

    const val TINK_KEYSET_PREFS_FILE = "ALGORAND_ENCR_ACCOUNTS"

    const val TINK_KEYSET_NAME = "ALGORAND_KEYSET"

    const val KEYSTORE_MASTER_KEY_URI = "android-keystore://algorand_keystore_key"

    const val KEYSTORE_MASTER_KEY_ALIAS = "algorand_keystore_key"

    val LEGACY_KEYSTORE_ALIASES = listOf(
        KEYSTORE_MASTER_KEY_ALIAS,
        "PeraAESKey",
        "PeraAESKey_strongbox",
    )

    const val ALGORAND_DB_NAME = "algorand-db"
    const val WALLET_CONNECT_V2_DB_NAME = "pera-wc-v2-db"
    const val WC_SESSION_STORE_FILE_NAME = "session_store.json"
    const val ADDRESS_DB_NAME = "address_database"
    const val PASSKEY_DB_NAME = "passkey_db"
    const val PERA_DB_NAME = "pera_database"

    val LEGACY_DATABASE_FILES = listOf(
        ALGORAND_DB_NAME,
        WALLET_CONNECT_V2_DB_NAME,
        ADDRESS_DB_NAME,
        PASSKEY_DB_NAME,
        PERA_DB_NAME,
    )

    const val LOG_TAG = "LegacyMigration"
}
