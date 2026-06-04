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

import com.algorand.perarn.migration.encryption.AesKeystoreDecryptor

internal data class HdSeedRow(
    val seedId: String,
    val entropy: ByteArray?,
)

internal data class HdKeyRow(
    val address: String,
    val seedId: String,
    val account: Int,
    val change: Int,
    val keyIndex: Int,
    val derivationType: Int,
    val decryptedPrivateKey: ByteArray?,
)

internal data class Algo25Row(
    val address: String,
    val decryptedSecretKey: ByteArray?,
)

internal data class LedgerBleRow(
    val address: String,
    val bluetoothAddress: String,
    val bluetoothName: String?,
    val positionInLedger: Int,
)

internal data class JointAccountRow(
    val address: String,
    val threshold: Int,
    val version: Int,
    val participants: List<String>,
)

internal class AccountsReader(
    private val coordinator: SchemaMigrationCoordinator,
    private val decryptor: AesKeystoreDecryptor,
) {

    fun readHdSeeds(): List<HdSeedRow> =
        openLegacyDatabaseReadOnly(coordinator, AddressDbMigrations.PLAN) { db ->
            val rows = ArrayList<HdSeedRow>()
            db.rawQuery(
                "SELECT $COLUMN_SEED_ID, $COLUMN_ENCRYPTED_ENTROPY FROM hd_seeds",
                null,
            ).use { c ->
                while (c.moveToNext()) {
                    rows += HdSeedRow(
                        seedId = c.optInt(COLUMN_SEED_ID)?.toString() ?: continue,
                        entropy = decryptor.decryptOrNull(c.optBlob(COLUMN_ENCRYPTED_ENTROPY)),
                    )
                }
            }
            rows
        }.orEmpty()

    fun readHdKeys(): List<HdKeyRow> =
        openLegacyDatabaseReadOnly(coordinator, AddressDbMigrations.PLAN) { db ->
            val rows = ArrayList<HdKeyRow>()
            db.rawQuery(
                "SELECT $COLUMN_ALGO_ADDRESS, $COLUMN_ENCRYPTED_PRIVATE_KEY, $COLUMN_SEED_ID, $COLUMN_ACCOUNT, $COLUMN_CHANGE, " +
                    "$COLUMN_KEY_INDEX, $COLUMN_DERIVATION_TYPE FROM hd_keys",
                null,
            ).use { c ->
                while (c.moveToNext()) {
                    val address = c.optString(COLUMN_ALGO_ADDRESS) ?: continue
                    rows += HdKeyRow(
                        address = address,
                        seedId = c.optInt(COLUMN_SEED_ID)?.toString() ?: continue,
                        account = c.optInt(COLUMN_ACCOUNT) ?: 0,
                        change = c.optInt(COLUMN_CHANGE) ?: 0,
                        keyIndex = c.optInt(COLUMN_KEY_INDEX) ?: 0,
                        derivationType = c.optInt(COLUMN_DERIVATION_TYPE) ?: 0,
                        decryptedPrivateKey = decryptor.decryptOrNull(c.optBlob(COLUMN_ENCRYPTED_PRIVATE_KEY)),
                    )
                }
            }
            rows
        }.orEmpty()

    fun readAlgo25(): List<Algo25Row> =
        openLegacyDatabaseReadOnly(coordinator, AddressDbMigrations.PLAN) { db ->
            val rows = ArrayList<Algo25Row>()
            db.rawQuery("SELECT $COLUMN_ALGO_ADDRESS, $COLUMN_ENCRYPTED_SECRET_KEY FROM algo_25", null).use { c ->
                while (c.moveToNext()) {
                    val address = c.optString(COLUMN_ALGO_ADDRESS) ?: continue
                    rows += Algo25Row(
                        address = address,
                        decryptedSecretKey = decryptor.decryptOrNull(c.optBlob(COLUMN_ENCRYPTED_SECRET_KEY)),
                    )
                }
            }
            rows
        }.orEmpty()

    fun readNoAuthAddresses(): List<String> =
        openLegacyDatabaseReadOnly(coordinator, AddressDbMigrations.PLAN) { db ->
            val rows = ArrayList<String>()
            db.rawQuery("SELECT $COLUMN_ALGO_ADDRESS FROM no_auth", null).use { c ->
                while (c.moveToNext()) {
                    c.optString(COLUMN_ALGO_ADDRESS)?.let { rows += it }
                }
            }
            rows
        }.orEmpty()

    fun readLedgerBle(): List<LedgerBleRow> =
        openLegacyDatabaseReadOnly(coordinator, AddressDbMigrations.PLAN) { db ->
            val rows = ArrayList<LedgerBleRow>()
            db.rawQuery(
                "SELECT $COLUMN_ALGO_ADDRESS, $COLUMN_DEVICE_MAC_ADDRESS, $COLUMN_ACCOUNT_INDEX_IN_LEDGER, $COLUMN_BLUETOOTH_NAME " +
                    "FROM ledger_ble",
                null,
            ).use { c ->
                while (c.moveToNext()) {
                    val address = c.optString(COLUMN_ALGO_ADDRESS) ?: continue
                    // F.5.c: Ledger row without a BLE address can't reconnect; drop so account routes as unroutable.
                    val bluetoothAddress = c.optString(COLUMN_DEVICE_MAC_ADDRESS) ?: continue
                    rows += LedgerBleRow(
                        address = address,
                        bluetoothAddress = bluetoothAddress,
                        bluetoothName = c.optString(COLUMN_BLUETOOTH_NAME),
                        positionInLedger = c.optInt(COLUMN_ACCOUNT_INDEX_IN_LEDGER) ?: 0,
                    )
                }
            }
            rows
        }.orEmpty()

    fun readJointAccounts(): List<JointAccountRow> =
        openLegacyDatabaseReadOnly(coordinator, AddressDbMigrations.PLAN) { db ->
            val byAddress = LinkedHashMap<String, MutableList<Pair<Int, String>>>()
            db.rawQuery(
                "SELECT $COLUMN_JOINT_ADDRESS, $COLUMN_PARTICIPANT_INDEX, $COLUMN_PARTICIPANT_ADDRESS FROM joint_participant",
                null,
            ).use { c ->
                while (c.moveToNext()) {
                    val joint = c.optString(COLUMN_JOINT_ADDRESS) ?: continue
                    val idx = c.optInt(COLUMN_PARTICIPANT_INDEX) ?: continue
                    val addr = c.optString(COLUMN_PARTICIPANT_ADDRESS) ?: continue
                    byAddress.getOrPut(joint) { mutableListOf() }.add(idx to addr)
                }
            }

            val rows = ArrayList<JointAccountRow>()
            db.rawQuery(
                "SELECT $COLUMN_ALGO_ADDRESS, $COLUMN_THRESHOLD, $COLUMN_VERSION FROM joint_account",
                null,
            ).use { c ->
                while (c.moveToNext()) {
                    val address = c.optString(COLUMN_ALGO_ADDRESS) ?: continue
                    // F.5.b: reject rows with missing threshold (would surface as broken multisig).
                    val threshold = c.optInt(COLUMN_THRESHOLD) ?: continue
                    // F.5.a: reject non-positive threshold.
                    if (threshold <= 0) continue
                    val participants = byAddress[address]
                        ?.sortedBy { it.first }
                        ?.map { it.second }
                        .orEmpty()
                    rows += JointAccountRow(
                        address = address,
                        threshold = threshold,
                        version = c.optInt(COLUMN_VERSION) ?: 0,
                        participants = participants,
                    )
                }
            }
            rows
        }.orEmpty()

    private companion object {
        const val COLUMN_ALGO_ADDRESS = "algo_address"
        const val COLUMN_SEED_ID = "seed_id"
        const val COLUMN_ENCRYPTED_ENTROPY = "encrypted_entropy"
        const val COLUMN_ENCRYPTED_PRIVATE_KEY = "encrypted_private_key"
        const val COLUMN_ENCRYPTED_SECRET_KEY = "encrypted_secret_key"
        const val COLUMN_ACCOUNT = "account"
        const val COLUMN_CHANGE = "change"
        const val COLUMN_KEY_INDEX = "key_index"
        const val COLUMN_DERIVATION_TYPE = "derivation_type"
        const val COLUMN_DEVICE_MAC_ADDRESS = "device_mac_address"
        const val COLUMN_BLUETOOTH_NAME = "bluetooth_name"
        const val COLUMN_ACCOUNT_INDEX_IN_LEDGER = "account_index_in_ledger"
        const val COLUMN_JOINT_ADDRESS = "joint_address"
        const val COLUMN_PARTICIPANT_INDEX = "participant_index"
        const val COLUMN_PARTICIPANT_ADDRESS = "participant_address"
        const val COLUMN_THRESHOLD = "threshold"
        const val COLUMN_VERSION = "version"
    }
}
