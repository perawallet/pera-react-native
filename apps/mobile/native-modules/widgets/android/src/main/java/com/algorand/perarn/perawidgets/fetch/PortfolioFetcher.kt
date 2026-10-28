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

import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import java.math.BigDecimal
import java.time.Instant
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.Serializable

@Serializable
data class PortfolioQuote(
    // Display units of ALGO.
    @Serializable(with = BigDecimalSerializer::class) val algo: BigDecimal,
    // Display units of `currencyCode`; null when no rate is known.
    @Serializable(with = BigDecimalSerializer::class) val fiat: BigDecimal?,
    val currencyCode: String,
    // ALGO value over the chosen period, oldest first.
    val chart: List<Double>,
    @Serializable(with = InstantSerializer::class) val fetchedAt: Instant,
) {
    // Fractional change across `chart`; null when it starts at zero.
    val change: Double?
        get() {
            val first = chart.firstOrNull() ?: return null
            val last = chart.last()
            return if (first != 0.0) (last - first) / first else null
        }
}

class PortfolioFetcher(get: HttpGet) {
    private val prices = PriceFetcher(get)

    // The same endpoint as the app's home chart: its last point is the current total.
    suspend fun fetch(
        addresses: List<String>,
        period: String,
        feed: WidgetSnapshot.PriceFeed,
        now: Instant = Instant.now(),
    ): PortfolioQuote? = coroutineScope {
        val code = feed.currencyCode
        if (addresses.isEmpty() || code.isNullOrBlank()) return@coroutineScope null
        val apiKey = feed.apiKey.orEmpty()

        // Commas stay literal: the backend expects the app's comma-joined array form.
        val path = "v1/wallet/wealth/?account_addresses=${addresses.joinToString(",")}&period=$period"
        val history = async { prices.getJson(feed.backendUrl, path, apiKey) }
        val rate = async { prices.usdRate(feed.backendUrl, code, apiKey) }

        val points = FetchJson.array(FetchJson.field(history.await(), "results"))
        val last = points?.lastOrNull() ?: return@coroutineScope null
        val algo = FetchJson.decimal(FetchJson.field(last, "algo_value")) ?: return@coroutineScope null

        val usd = FetchJson.decimal(FetchJson.field(last, "usd_value"))
        val rateValue = rate.await()
        val fiat = if (usd != null && rateValue != null) usd.multiply(rateValue) else null
        val chart = points.mapNotNull { FetchJson.decimal(FetchJson.field(it, "algo_value"))?.toDouble() }

        PortfolioQuote(algo, fiat, code, chart, now)
    }
}
