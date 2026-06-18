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
import com.algorand.perarn.migration.database.ContactRow
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray

internal fun List<ContactRow>.toContactsArray(): WritableArray {
    val out = Arguments.createArray()
    for (row in this) {
        val map = Arguments.createMap()
        map.putString("name", row.name)
        map.putString("address", row.address)
        map.putStringOrNull("avatar", row.avatar)
        out.pushMap(map)
    }
    return out
}
