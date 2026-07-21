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
package com.algorand.perarn.migration.builder

import com.algorand.perarn.migration.accounts.LegacyAccountType
import com.algorand.perarn.migration.bridge.putBytesOrNull
import com.algorand.perarn.migration.bridge.putStringOrNull
import com.algorand.perarn.migration.database.Algo25Row
import com.algorand.perarn.migration.database.CustomAccountInfoRow
import com.algorand.perarn.migration.database.HdKeyRow
import com.algorand.perarn.migration.database.JointAccountRow
import com.algorand.perarn.migration.database.LedgerBleRow
import com.algorand.perarn.migration.sharedprefs.PreSixxAccountRow
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

private object Fields {
    const val ADDRESS = "address"
    const val NAME = "name"
    const val TYPE = "type"
    const val PREFERRED_ORDER = "preferredOrder"
    const val IS_BACKED_UP = "isBackedUp"
    const val SECRET_KEY = "secretKey"
    const val HD_WALLET_ID = "hdWalletId"
    const val LEDGER = "ledger"
    const val JOINT = "joint"
}

internal fun composeAccountsArray(
    hdKeys: Map<String, HdKeyRow>,
    algo25: Map<String, Algo25Row>,
    noAuth: Set<String>,
    ledgerBle: Map<String, LedgerBleRow>,
    joints: List<JointAccountRow>,
    customInfo: Map<String, CustomAccountInfoRow>,
    preSixxAccounts: List<PreSixxAccountRow> = emptyList(),
): WritableArray {
    val seen = HashSet<String>()
    val out = Arguments.createArray()

    for ((address, row) in hdKeys) {
        if (address in seen) continue
        seen += address
        out.pushMap(row.toBridgeMap(customInfo[address]))
    }

    for ((address, row) in algo25) {
        if (address in seen) continue
        seen += address
        out.pushMap(row.toBridgeMap(customInfo[address]))
    }

    for ((address, row) in ledgerBle) {
        if (address in seen) continue
        seen += address
        out.pushMap(row.toBridgeMap(customInfo[address]))
    }

    for (address in noAuth) {
        if (address in seen) continue
        seen += address
        out.pushMap(buildWatchAccount(address, customInfo[address]))
    }

    for (joint in joints) {
        if (joint.address in seen) continue
        seen += joint.address
        out.pushMap(joint.toBridgeMap(customInfo[joint.address]))
    }

    for (row in preSixxAccounts) {
        if (row.address in seen) continue
        seen += row.address
        out.pushMap(row.toBridgeMap(customInfo[row.address]))
    }
    return out
}

private fun HdKeyRow.toBridgeMap(info: CustomAccountInfoRow?): WritableMap =
    newAccountMap(
        address = address,
        type = LegacyAccountType.Standard,
        info = info,
        hdWalletId = seedId,
    )

private fun Algo25Row.toBridgeMap(
    info: CustomAccountInfoRow?,
): WritableMap {
    // Pera 6 flagged rekeyed-away accounts as no_auth, but signability in
    // Pera 7 is derived from the synced on-chain auth-addr — keep the key.
    val map = newAccountMap(
        address = address,
        type = LegacyAccountType.Standard,
        info = info,
        secretKey = decryptedSecretKey,
    )
    decryptedSecretKey?.fill(0)
    return map
}

private fun LedgerBleRow.toBridgeMap(info: CustomAccountInfoRow?): WritableMap {
    val ledgerMap = Arguments.createMap().apply {
        putString("bluetoothAddress", bluetoothAddress)
        putStringOrNull("bluetoothName", bluetoothName)
        putInt("positionInLedger", positionInLedger)
    }
    return newAccountMap(
        address = address,
        type = LegacyAccountType.Ledger,
        info = info,
        ledger = ledgerMap,
    )
}

private fun buildWatchAccount(address: String, info: CustomAccountInfoRow?): WritableMap =
    newAccountMap(address = address, type = LegacyAccountType.Watch, info = info)

private fun JointAccountRow.toBridgeMap(info: CustomAccountInfoRow?): WritableMap {
    val jointMap = Arguments.createMap().apply {
        putInt("threshold", threshold)
        putInt("version", version)
        val participantsArray = Arguments.createArray()
        for (p in participants) participantsArray.pushString(p)
        putArray("participants", participantsArray)
    }
    return newAccountMap(
        address = address,
        type = LegacyAccountType.Joint,
        info = info,
        joint = jointMap,
    )
}

private fun PreSixxAccountRow.toBridgeMap(post6xInfo: CustomAccountInfoRow?): WritableMap {
    val info = post6xInfo ?: CustomAccountInfoRow(
        address = address,
        name = name.ifEmpty { null },
        orderIndex = index,
        isBackedUp = isBackedUp,
    )
    return when (this) {
        is PreSixxAccountRow.Standard -> {
            val map = newAccountMap(
                address = address,
                type = LegacyAccountType.Standard,
                info = info,
                secretKey = secretKey,
            )
            secretKey?.fill(0)
            map
        }
        is PreSixxAccountRow.Ledger -> newAccountMap(
            address = address,
            type = LegacyAccountType.Ledger,
            info = info,
            ledger = Arguments.createMap().apply {
                putString("bluetoothAddress", bluetoothAddress)
                putStringOrNull("bluetoothName", bluetoothName)
                putInt("positionInLedger", positionInLedger)
            },
        )
        is PreSixxAccountRow.Watch -> newAccountMap(
            address = address,
            type = LegacyAccountType.Watch,
            info = info,
        )
    }
}

private fun newAccountMap(
    address: String,
    type: LegacyAccountType,
    info: CustomAccountInfoRow?,
    secretKey: ByteArray? = null,
    hdWalletId: String? = null,
    ledger: WritableMap? = null,
    joint: WritableMap? = null,
): WritableMap {
    val map = Arguments.createMap()
    map.putString(Fields.ADDRESS, address)
    map.putString(Fields.NAME, info?.name.orEmpty())
    map.putString(Fields.TYPE, type.rnValue)
    map.putInt(Fields.PREFERRED_ORDER, info?.orderIndex ?: -1)
    map.putBoolean(Fields.IS_BACKED_UP, info?.isBackedUp ?: false)
    map.putBytesOrNull(Fields.SECRET_KEY, secretKey)
    map.putStringOrNull(Fields.HD_WALLET_ID, hdWalletId)
    if (ledger != null) map.putMap(Fields.LEDGER, ledger) else map.putNull(Fields.LEDGER)
    if (joint != null) map.putMap(Fields.JOINT, joint) else map.putNull(Fields.JOINT)
    return map
}
