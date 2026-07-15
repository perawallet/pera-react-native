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
import org.json.JSONException
import org.json.JSONObject

internal fun SharedPreferences.optBool(key: String): Boolean? =
    if (contains(key)) try {
        getBoolean(key, false)
    } catch (_: ClassCastException) {
        null
    } else null

internal fun SharedPreferences.optInt(key: String, sentinel: Int? = null): Int? {
    if (!contains(key)) return null
    return try {
        val value = getInt(key, 0)
        if (sentinel != null && value == sentinel) null else value
    } catch (_: ClassCastException) {
        null
    }
}

internal fun SharedPreferences.optLong(key: String): Long? {
    if (!contains(key)) return null
    return try {
        getLong(key, 0L)
    } catch (_: ClassCastException) {
        getString(key, null)?.toLongOrNull()
    }
}

internal fun SharedPreferences.optString(key: String): String? {
    if (!contains(key)) return null
    return try {
        getString(key, null)
    } catch (_: ClassCastException) {
        null
    }
}

internal fun SharedPreferences.optJsonString(key: String): String? {
    val raw = optString(key) ?: return null
    if (raw.isBlank()) return null
    return try {
        val wrapper = JSONObject("{\"v\":$raw}")
        wrapper.optString("v").takeIf { it.isNotEmpty() }
    } catch (_: JSONException) {
        raw
    }
}

internal fun SharedPreferences.optJsonBool(key: String): Boolean? {
    val raw = optString(key) ?: return null
    return try {
        val wrapper = JSONObject("{\"v\":$raw}")
        if (wrapper.isNull("v")) null else wrapper.optBoolean("v")
    } catch (_: JSONException) {
        raw.toBooleanStrictOrNull()
    }
}

internal fun SharedPreferences.optJsonDouble(key: String): Double? {
    val raw = optString(key) ?: return null
    return try {
        val wrapper = JSONObject("{\"v\":$raw}")
        if (wrapper.isNull("v")) null else wrapper.optDouble("v")
    } catch (_: JSONException) {
        raw.toDoubleOrNull()
    }
}
