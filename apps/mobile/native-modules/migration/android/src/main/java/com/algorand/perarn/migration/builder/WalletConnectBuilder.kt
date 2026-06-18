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

import com.algorand.perarn.migration.bridge.putStringOrNull
import com.algorand.perarn.migration.database.WalletConnectV1SessionRow
import com.algorand.perarn.migration.database.WalletConnectV2SessionRow
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import org.json.JSONObject

internal fun List<WalletConnectV1SessionRow>.toWalletConnectV1Array(): WritableArray {
    val out = Arguments.createArray()
    for (row in this) {
        val map = Arguments.createMap()
        map.putString("id", row.id)
        map.putMap("peerMeta", parsePeerMeta(row.peerMetaJson))
        map.putBoolean("isConnected", row.isConnected)
        map.putBoolean("isSubscribed", row.isSubscribed)
        map.putString("dateTimestampMs", row.dateTimestampMs.toString())
        map.putStringOrNull("fallbackBrowserGroupResponse", row.fallbackBrowserGroupResponse)
        val accounts = Arguments.createArray()
        for (a in row.connectedAccounts) accounts.pushString(a)
        map.putArray("connectedAccounts", accounts)
        map.putString("sessionMetaJson", row.sessionMetaJson)
        out.pushMap(map)
    }
    return out
}

internal fun List<WalletConnectV2SessionRow>.toWalletConnectV2Array(): WritableArray {
    val out = Arguments.createArray()
    for (row in this) {
        val map = Arguments.createMap()
        map.putString("topic", row.topic)
        map.putString("dateTimestampMs", row.dateTimestampMs.toString())
        map.putBoolean("isSubscribed", row.isSubscribed)
        map.putStringOrNull("fallbackBrowserGroupResponse", row.fallbackBrowserGroupResponse)
        out.pushMap(map)
    }
    return out
}

private fun parsePeerMeta(json: String): WritableMap {
    val map = Arguments.createMap()
    try {
        val obj = JSONObject(json)
        map.putString("name", obj.optString("name", ""))
        map.putString("url", obj.optString("url", ""))
        map.putString("description", obj.optString("description", ""))
        val icons = Arguments.createArray()
        val iconArray = obj.optJSONArray("icons")
        if (iconArray != null) {
            for (i in 0 until iconArray.length()) {
                val s = iconArray.optString(i, "")
                if (s.isNotEmpty()) icons.pushString(s)
            }
        }
        map.putArray("icons", icons)
    } catch (_: Throwable) {
        map.putString("name", "")
        map.putString("url", "")
        map.putString("description", "")
        map.putArray("icons", Arguments.createArray())
    }
    return map
}
