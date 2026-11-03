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

// A quote is only valid for the network, accounts or asset, period and currency it was fetched for. Each key starts
// with its kind, which is how a widget's older entries of that kind are found and dropped.
object QuoteKeys {
    const val PRICE = "price"
    const val PORTFOLIO = "portfolio"
    const val TRANSACTIONS = "transactions"

    fun price(backendUrl: String?, assetId: String, period: String, quote: QuoteCurrency): String =
        listOf(PRICE, backendUrl.orEmpty(), assetId, period, quote.code).joinToString("|")

    fun portfolio(backendUrl: String?, addresses: List<String>, period: String, currencyCode: String?): String =
        listOf(PORTFOLIO, backendUrl.orEmpty(), addresses.sorted().joinToString(","), period, currencyCode.orEmpty())
            .joinToString("|")

    // Rows hold formatted amounts, so the locale is part of the key.
    fun transactions(backendUrl: String?, addresses: List<String>, locale: String?): String =
        listOf(TRANSACTIONS, backendUrl.orEmpty(), addresses.sorted().joinToString(","), locale.orEmpty()).joinToString("|")

    fun kind(key: String): String = key.substringBefore('|')
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

    // One entry per kind per widget: a quote for a removed account, or an old currency, period or locale, holds
    // addresses and balances nothing will read again.
    inline fun <reified T> put(widgetId: Int, key: String, value: T) {
        val stored = storageKey(widgetId, key)
        val sameKind = storageKey(widgetId, QuoteKeys.kind(key) + "|")
        store.keys().filter { it.startsWith(sameKind) && it != stored }.forEach { store.remove(it) }
        store.put(stored, json.encodeToString(serializer<T>(), value))
    }

    fun remove(widgetId: Int, key: String) = store.remove(storageKey(widgetId, key))

    fun clear(widgetId: Int) {
        val prefix = "quote.$widgetId."
        store.keys().filter { it.startsWith(prefix) }.forEach { store.remove(it) }
    }

    // Privacy mode keeps no balances or rows on disk, for any widget; prices name no account and stay.
    fun clearAccountData() {
        val kinds = setOf(QuoteKeys.PORTFOLIO, QuoteKeys.TRANSACTIONS)
        store.keys().filter { QuoteKeys.kind(innerKey(it)) in kinds }.forEach { store.remove(it) }
    }

    private fun innerKey(storageKey: String) = storageKey.removePrefix("quote.").substringAfter('.')

    @PublishedApi
    internal fun storageKey(widgetId: Int, key: String) = "quote.$widgetId.$key"

    companion object {
        // Keys hold account addresses and values hold balances, so a wallet wipe removes the whole file, synchronously
        // so it reaches disk before the app can be closed.
        fun clearAll(context: Context) {
            context.getSharedPreferences(QUOTE_PREFERENCES, Context.MODE_PRIVATE).edit().clear().commit()
        }
    }
}
