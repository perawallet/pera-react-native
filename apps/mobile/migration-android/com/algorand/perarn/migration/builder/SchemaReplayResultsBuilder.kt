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

import com.algorand.perarn.migration.database.ReplayResult
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

internal fun composeSchemaReplayResults(results: Map<String, ReplayResult>): WritableMap {
    val out = Arguments.createMap()
    for ((dbName, result) in results) {
        out.putMap(dbName, result.toBridgeMap())
    }
    return out
}

private fun ReplayResult.toBridgeMap(): WritableMap {
    val map = Arguments.createMap()
    when (this) {
        is ReplayResult.Missing -> {
            map.putString("kind", "missing")
        }
        is ReplayResult.NotNeeded -> {
            map.putString("kind", "notNeeded")
            map.putInt("currentVersion", currentVersion)
        }
        is ReplayResult.Ahead -> {
            map.putString("kind", "ahead")
            map.putInt("currentVersion", currentVersion)
        }
        is ReplayResult.Replayed -> {
            map.putString("kind", "replayed")
            map.putInt("fromVersion", fromVersion)
            map.putInt("toVersion", toVersion)
        }
        is ReplayResult.TooOld -> {
            map.putString("kind", "tooOld")
            map.putInt("currentVersion", currentVersion)
            map.putInt("oldestSupported", oldestSupported)
        }
        is ReplayResult.Failed -> {
            map.putString("kind", "failed")
            map.putInt("partialVersion", partialVersion)
            map.putString("errorMessage", cause.message ?: cause.javaClass.simpleName)
        }
    }
    return map
}
