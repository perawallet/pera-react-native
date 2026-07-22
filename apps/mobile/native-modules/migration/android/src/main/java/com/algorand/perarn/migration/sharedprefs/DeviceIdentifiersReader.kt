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
package com.algorand.perarn.migration.sharedprefs

import android.content.SharedPreferences
import com.algorand.perarn.migration.bridge.putLongStringOrNull
import com.algorand.perarn.migration.bridge.putStringOrNull
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

internal class DeviceIdentifiersReader(private val prefs: SharedPreferences) {

    fun build(): WritableMap {
        val map = Arguments.createMap()
        map.putStringOrNull("notificationUserId", prefs.optString("notification_user_id"))
        map.putStringOrNull("mainnetDeviceId", prefs.optString("mainnet_device_id"))
        map.putStringOrNull("testnetDeviceId", prefs.optString("testnet_device_id"))
        map.putLongStringOrNull(
            "lastSeenNotificationId",
            prefs.optLong("last_seen_notification_id"),
            sentinel = Long.MIN_VALUE,
        )
        map.putStringOrNull("legacyFallbackDeviceId", prefs.optString("notification_user_id"))
        return map
    }
}
