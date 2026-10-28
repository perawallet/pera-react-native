/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */
package com.algorand.perarn.perawidgets.fetch

import java.math.BigDecimal
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

internal object FetchJson {
    fun parse(text: String?): JsonElement? {
        if (text == null) return null
        return try {
            Json.parseToJsonElement(text)
        } catch (_: Exception) {
            null
        }
    }

    // The backend sends amounts as strings, occasionally as numbers; BigDecimal avoids float drift.
    fun decimal(element: JsonElement?): BigDecimal? {
        val primitive = element as? JsonPrimitive ?: return null
        if (primitive is kotlinx.serialization.json.JsonNull) return null
        return try {
            BigDecimal(primitive.content)
        } catch (_: NumberFormatException) {
            null
        }
    }

    fun string(element: JsonElement?): String? {
        val primitive = element as? JsonPrimitive ?: return null
        return if (primitive is kotlinx.serialization.json.JsonNull) null else primitive.content
    }

    fun field(element: JsonElement?, name: String): JsonElement? = (element as? JsonObject)?.get(name)

    fun array(element: JsonElement?): JsonArray? = element as? JsonArray
}

internal fun endpoint(backendUrl: String?, path: String): String? {
    if (backendUrl.isNullOrBlank()) return null
    val uri = try {
        java.net.URI(backendUrl)
    } catch (_: Exception) {
        return null
    }
    if (uri.scheme == null || uri.host == null) return null
    return backendUrl.trimEnd('/') + "/" + path
}
