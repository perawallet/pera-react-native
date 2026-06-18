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
package com.algorand.perarn.migration.builder

import com.algorand.perarn.migration.bridge.putBytesOrNull
import com.algorand.perarn.migration.bridge.putStringOrNull
import com.algorand.perarn.migration.database.CustomHdSeedInfoRow
import com.algorand.perarn.migration.database.HdKeyRow
import com.algorand.perarn.migration.database.HdSeedRow
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

internal fun composeHdWalletsArray(
    hdSeeds: List<HdSeedRow>,
    hdKeysBySeed: Map<String, List<HdKeyRow>>,
    customHdSeedInfo: Map<String, CustomHdSeedInfoRow>,
): WritableArray = Arguments.createArray().apply {
    for (seed in hdSeeds) {
        pushMap(
            seed.toBridgeMap(
                keys = hdKeysBySeed[seed.seedId].orEmpty(),
                seedInfo = customHdSeedInfo[seed.seedId],
            ),
        )
    }
}

private fun HdSeedRow.toBridgeMap(
    keys: List<HdKeyRow>,
    seedInfo: CustomHdSeedInfoRow?,
): WritableMap {
    val map = Arguments.createMap()
    map.putString("walletId", seedId)
    map.putStringOrNull("name", seedInfo?.name)
    map.putBytesOrNull("entropy", entropy)
    val keysArray = Arguments.createArray()
    val sortedKeys = keys.sortedWith(
        compareBy({ it.account }, { it.change }, { it.keyIndex }),
    )
    for (key in sortedKeys) {
        keysArray.pushMap(key.toBridgeKeyMap())
    }
    map.putArray("keys", keysArray)
    entropy?.fill(0)
    return map
}

private fun HdKeyRow.toBridgeKeyMap(): WritableMap {
    val map = Arguments.createMap()
    map.putString("address", address)
    map.putInt("account", account)
    map.putInt("change", change)
    map.putInt("keyIndex", keyIndex)
    map.putInt("derivationType", derivationType)
    map.putBytesOrNull("privateKey", decryptedPrivateKey)
    decryptedPrivateKey?.fill(0)
    return map
}
