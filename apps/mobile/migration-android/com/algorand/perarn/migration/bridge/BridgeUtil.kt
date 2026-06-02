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
package com.algorand.perarn.migration.bridge

import android.util.Base64
import com.facebook.react.bridge.WritableMap

internal object Base64Util {
    fun encode(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)
}

internal fun WritableMap.putStringOrNull(key: String, value: String?) {
    if (value == null) putNull(key) else putString(key, value)
}

internal fun WritableMap.putBoolOrNull(key: String, value: Boolean?) {
    if (value == null) putNull(key) else putBoolean(key, value)
}

internal fun WritableMap.putIntOrNull(key: String, value: Int?) {
    if (value == null) putNull(key) else putInt(key, value)
}

internal fun WritableMap.putDoubleOrNull(key: String, value: Double?) {
    if (value == null) putNull(key) else putDouble(key, value)
}

internal fun WritableMap.putLongStringOrNull(key: String, value: Long?, sentinel: Long? = null) {
    if (value == null || (sentinel != null && value == sentinel)) {
        putNull(key)
    } else {
        putString(key, value.toString())
    }
}

internal fun WritableMap.putBytesOrNull(key: String, bytes: ByteArray?) {
    if (bytes == null) putNull(key) else putString(key, Base64Util.encode(bytes))
}
