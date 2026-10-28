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
package com.algorand.perarn.perawidgets.config

import android.content.Context
import com.algorand.perarn.perawidgets.fetch.KeyValueStore
import com.algorand.perarn.perawidgets.fetch.SharedPreferencesStore
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.serializer

@Serializable
enum class Period(val api: String?) {
  Default(null),
  Day("one-day"),
  Week("one-week"),
  Month("one-month"),
  Year("one-year"),
}

@Serializable
data class PortfolioOptions(
  val period: Period = Period.Default,
  val showChart: Boolean = true,
  // Null means every account.
  val accountAddress: String? = null,
)

@Serializable
data class PriceOptions(
  val assetId: String = NATIVE_ASSET_ID,
  // Null means the app's currency.
  val currencyCode: String? = null,
  val period: Period = Period.Week,
  val showAssetPerCurrency: Boolean = true,
)

@Serializable
data class ReceiveOptions(
  // Null means the first receive target.
  val accountAddress: String? = null,
)

const val NATIVE_ASSET_ID = "0"

private const val PREFERENCES = "pera_widgets_config"

class WidgetConfig(private val store: KeyValueStore) {
  constructor(context: Context) : this(
    SharedPreferencesStore(context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)),
  )

  private val json = Json { ignoreUnknownKeys = true }

  fun portfolio(id: Int): PortfolioOptions = read(id, "portfolio") ?: PortfolioOptions()

  fun price(id: Int): PriceOptions = read(id, "price") ?: PriceOptions()

  fun receive(id: Int): ReceiveOptions = read(id, "receive") ?: ReceiveOptions()

  fun save(id: Int, options: PortfolioOptions) = write(id, "portfolio", options)

  fun save(id: Int, options: PriceOptions) = write(id, "price", options)

  fun save(id: Int, options: ReceiveOptions) = write(id, "receive", options)

  fun delete(id: Int) {
    KINDS.forEach { store.remove(key(id, it)) }
  }

  private inline fun <reified T> read(id: Int, kind: String): T? {
    val raw = store.get(key(id, kind)) ?: return null
    return try {
      json.decodeFromString(serializer<T>(), raw)
    } catch (_: Exception) {
      null
    }
  }

  private inline fun <reified T> write(id: Int, kind: String, value: T) {
    store.put(key(id, kind), json.encodeToString(serializer<T>(), value))
  }

  private fun key(id: Int, kind: String) = "$kind.$id"

  companion object {
    private val KINDS = listOf("portfolio", "price", "receive")

    // Holds chosen account addresses, so a wallet wipe removes the whole file.
    fun clearAll(context: Context) {
      context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit().clear().apply()
    }
  }
}

fun resolvePortfolioAccount(options: PortfolioOptions, snapshot: WidgetSnapshot?): WidgetSnapshot.PortfolioFeed.Account? {
  val address = options.accountAddress ?: return null
  return snapshot?.portfolioFeed?.accounts?.firstOrNull { it.address == address }
}

fun resolveReceiveTarget(options: ReceiveOptions, snapshot: WidgetSnapshot?): WidgetSnapshot.ReceiveTarget? {
  val targets = snapshot?.receiveTargets.orEmpty()
  return targets.firstOrNull { it.address == options.accountAddress } ?: targets.firstOrNull()
}

// A stale id would otherwise keep quoting an asset the app no longer shares.
fun resolvePriceAssetId(options: PriceOptions, snapshot: WidgetSnapshot?): String =
  if (options.assetId == NATIVE_ASSET_ID || snapshot?.assetOptions.orEmpty().any { it.assetId == options.assetId }) {
    options.assetId
  } else {
    NATIVE_ASSET_ID
  }
