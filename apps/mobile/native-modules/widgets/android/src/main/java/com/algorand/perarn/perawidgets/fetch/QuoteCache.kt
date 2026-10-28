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

import android.content.Context
import android.content.SharedPreferences
import com.algorand.perarn.perawidgets.format.QuoteCurrency
import kotlinx.serialization.json.Json
import kotlinx.serialization.serializer

interface KeyValueStore {
    fun get(key: String): String?
    fun put(key: String, value: String)
    fun remove(key: String)
    fun keys(): Set<String>
}

class SharedPreferencesStore(private val prefs: SharedPreferences) : KeyValueStore {
    override fun get(key: String): String? = prefs.getString(key, null)
    override fun put(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }
    override fun remove(key: String) {
        prefs.edit().remove(key).apply()
    }
    override fun keys(): Set<String> = prefs.all.keys.toSet()
}

class InMemoryStore : KeyValueStore {
    private val values = HashMap<String, String>()
    override fun get(key: String): String? = values[key]
    override fun put(key: String, value: String) {
        values[key] = value
    }
    override fun remove(key: String) {
        values.remove(key)
    }
    override fun keys(): Set<String> = values.keys.toSet()
}

data class Cached<T>(val value: T)

// A quote is only valid for the network, accounts or asset, period and currency it was fetched for.
object QuoteKeys {
    fun price(backendUrl: String?, assetId: String, period: String, quote: QuoteCurrency): String =
        listOf("price", backendUrl.orEmpty(), assetId, period, quote.code).joinToString("|")

    fun portfolio(backendUrl: String?, addresses: List<String>, period: String, currencyCode: String?): String =
        listOf("portfolio", backendUrl.orEmpty(), addresses.sorted().joinToString(","), period, currencyCode.orEmpty())
            .joinToString("|")
}

private const val QUOTE_PREFERENCES = "pera_widgets_quotes"

class QuoteCache(@PublishedApi internal val store: KeyValueStore) {
    constructor(context: Context) : this(
        SharedPreferencesStore(context.getSharedPreferences(QUOTE_PREFERENCES, Context.MODE_PRIVATE)),
    )

    @PublishedApi internal val json = Json { ignoreUnknownKeys = true }

    inline fun <reified T> get(widgetId: Int, key: String): Cached<T>? {
        val raw = store.get(storageKey(widgetId, key)) ?: return null
        return try {
            Cached(json.decodeFromString(serializer<T>(), raw))
        } catch (_: Exception) {
            null
        }
    }

    inline fun <reified T> put(widgetId: Int, key: String, value: T) {
        store.put(storageKey(widgetId, key), json.encodeToString(serializer<T>(), value))
    }

    fun clear(widgetId: Int) {
        val prefix = "quote.$widgetId."
        store.keys().filter { it.startsWith(prefix) }.forEach { store.remove(it) }
    }

    @PublishedApi
    internal fun storageKey(widgetId: Int, key: String) = "quote.$widgetId.$key"

    companion object {
        // Keys hold account addresses and values hold balances, so a wallet wipe removes the whole file.
        fun clearAll(context: Context) {
            context.getSharedPreferences(QUOTE_PREFERENCES, Context.MODE_PRIVATE).edit().clear().apply()
        }
    }
}
