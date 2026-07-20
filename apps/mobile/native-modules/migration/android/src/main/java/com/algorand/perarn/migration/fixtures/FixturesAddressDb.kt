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
import com.algorand.perarn.migration.encryption.AesKeystoreEncryptor

internal object FixturesAddressDb {

    fun insert(
        db: SQLiteDatabase,
        version: Int,
        encryptor: AesKeystoreEncryptor,
        includeUnroutable: Boolean,
    ) {
        insertHdSeed(db, encryptor)
        insertHdKeys(db, encryptor)
        insertAlgo25(db, encryptor)
        insertNoAuth(db)
        insertLedgerBle(db)
        if (version >= 2) {
            insertJointAccount(db)
            insertJointParticipants(db)
        }
        if (includeUnroutable) {
            insertNoKeyStandard(db)
        }
    }

    private fun insertNoKeyStandard(db: SQLiteDatabase) {
        db.insert(
            "algo_25",
            null,
            ContentValues().apply {
                put("algo_address", FixtureIdentities.STANDARD_NO_KEY_ADDRESS)
                putNull("encrypted_secret_key")
            },
        )
    }

    private fun insertHdSeed(db: SQLiteDatabase, enc: AesKeystoreEncryptor) {
        val entropy = hexToBytes(FixtureCrypto.HD_WALLET_ENTROPY_HEX)
        db.insert(
            "hd_seeds",
            null,
            ContentValues().apply {
                put("seed_id", FixtureIdentities.SEED_1_ID)
                put("encrypted_entropy", enc.encrypt(entropy))
            },
        )
    }

    private fun insertHdKeys(db: SQLiteDatabase, enc: AesKeystoreEncryptor) {
        for (descriptor in HD_KEY_FIXTURES) {
            db.insert(
                "hd_keys",
                null,
                ContentValues().apply {
                    put("algo_address", descriptor.address)
                    put("seed_id", FixtureIdentities.SEED_1_ID)
                    put("account", descriptor.account)
                    put("change", descriptor.change)
                    put("key_index", descriptor.keyIndex)
                    put("derivation_type", DERIVATION_TYPE_PEIKERT)
                    put("encrypted_private_key", enc.encrypt(hexToBytes(descriptor.sk64Hex)))
                },
            )
        }
    }

    private fun insertAlgo25(db: SQLiteDatabase, enc: AesKeystoreEncryptor) {
        db.insert(
            "algo_25",
            null,
            ContentValues().apply {
                put("algo_address", FixtureCrypto.ALGO25_VALID_ADDRESS)
                put(
                    "encrypted_secret_key",
                    enc.encrypt(hexToBytes(FixtureCrypto.ALGO25_VALID_SK64_HEX)),
                )
            },
        )
        // Algo25 account that was marked no_auth in Pera 6 (rekeyed-away) but
        // Pera 7 now derives signability dynamically, so keep the key.
        db.insert(
            "algo_25",
            null,
            ContentValues().apply {
                put("algo_address", ALGO25_REKEYED_AWAY_ADDRESS)
                put(
                    "encrypted_secret_key",
                    enc.encrypt(hexToBytes(ALGO25_REKEYED_AWAY_SK64_HEX)),
                )
            },
        )
    }

    private fun insertNoAuth(db: SQLiteDatabase) {
        for (address in listOf(
            FixtureIdentities.WATCH_ONLY_1_ADDRESS,
            FixtureIdentities.WATCH_ONLY_2_ADDRESS,
            ALGO25_REKEYED_AWAY_ADDRESS,
        )) {
            db.insert(
                "no_auth",
                null,
                ContentValues().apply { put("algo_address", address) },
            )
        }
    }

    private fun insertLedgerBle(db: SQLiteDatabase) {
        db.insert(
            "ledger_ble",
            null,
            ContentValues().apply {
                put("algo_address", FixtureIdentities.LEDGER_VALID_1_ADDRESS)
                put("device_mac_address", "AA:BB:CC:DD:EE:01")
                put("bluetooth_name", "Pera Nano X")
                put("account_index_in_ledger", 0)
            },
        )
        db.insert(
            "ledger_ble",
            null,
            ContentValues().apply {
                put("algo_address", FixtureIdentities.LEDGER_VALID_2_ADDRESS)
                put("device_mac_address", "AA:BB:CC:DD:EE:02")
                putNull("bluetooth_name")
                put("account_index_in_ledger", 3)
            },
        )
    }

    private fun insertJointAccount(db: SQLiteDatabase) {
        db.insert(
            "joint_account",
            null,
            ContentValues().apply {
                put("algo_address", JOINT_ADDRESS)
                put("threshold", 2)
                put("version", 1)
            },
        )
    }

    private fun insertJointParticipants(db: SQLiteDatabase) {
        val participants = listOf(
            FixtureIdentities.HD_KEY_0_ADDRESS,
            FixtureIdentities.ALGO25_VALID_ADDRESS,
            FixtureIdentities.EXTERNAL_PARTICIPANT_ADDRESS,
        )
        participants.forEachIndexed { idx, address ->
            db.insert(
                "joint_participant",
                null,
                ContentValues().apply {
                    put("joint_address", JOINT_ADDRESS)
                    put("participant_index", idx)
                    put("participant_address", address)
                },
            )
        }
    }

    private val JOINT_ADDRESS = FixtureCrypto.EXTERNAL_PARTICIPANT_ADDRESS

    // Algo25 account marked no_auth in Pera 6 but kept in Pera 7
    private const val ALGO25_REKEYED_AWAY_ADDRESS = "ZZ4REKEYED3EF6N27XZSJZPTMDWVCCM5X3XMQC4XNKGJLMRZ5M"
    private const val ALGO25_REKEYED_AWAY_SK64_HEX = "6d6967726174696f6e2d73696d756c61746f722d616c676f32352d726b65796564f6c5d51380e2b3debd05babdc1a6e7a35b27eb37e073df787b1b8523600d376a"

    private data class HdKeyDescriptor(
        val address: String,
        val account: Int,
        val change: Int,
        val keyIndex: Int,
        val sk64Hex: String,
    )

    private val HD_KEY_FIXTURES = listOf(
        HdKeyDescriptor(
            address = FixtureCrypto.HD_KEY_0_ADDRESS,
            account = 0,
            change = 0,
            keyIndex = 0,
            sk64Hex = FixtureCrypto.HD_KEY_0_SK64_HEX,
        ),
        HdKeyDescriptor(
            address = FixtureCrypto.HD_KEY_1_ADDRESS,
            account = 0,
            change = 0,
            keyIndex = 1,
            sk64Hex = FixtureCrypto.HD_KEY_1_SK64_HEX,
        ),
        HdKeyDescriptor(
            address = FixtureCrypto.HD_KEY_2_ADDRESS,
            account = 0,
            change = 0,
            keyIndex = 2,
            sk64Hex = FixtureCrypto.HD_KEY_2_SK64_HEX,
        ),
    )

    private const val DERIVATION_TYPE_PEIKERT = 9

    private fun hexToBytes(hex: String): ByteArray {
        require(hex.length % 2 == 0) { "hex string must have even length: ${hex.length}" }
        val out = ByteArray(hex.length / 2)
        for (i in out.indices) {
            val hi = Character.digit(hex[i * 2], 16)
            val lo = Character.digit(hex[i * 2 + 1], 16)
            require(hi >= 0 && lo >= 0) { "invalid hex at index ${i * 2}" }
            out[i] = ((hi shl 4) or lo).toByte()
        }
        return out
    }
}
