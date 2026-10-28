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
package com.algorand.perarn.perawidgets.refresh

import android.content.Context
import com.algorand.perarn.perawidgets.config.PortfolioOptions
import com.algorand.perarn.perawidgets.config.PriceOptions
import com.algorand.perarn.perawidgets.config.resolvePriceAssetId
import com.algorand.perarn.perawidgets.fetch.Http
import com.algorand.perarn.perawidgets.fetch.HttpGet
import com.algorand.perarn.perawidgets.fetch.PortfolioFetcher
import com.algorand.perarn.perawidgets.fetch.PortfolioQuote
import com.algorand.perarn.perawidgets.fetch.PriceFetcher
import com.algorand.perarn.perawidgets.fetch.PriceQuote
import com.algorand.perarn.perawidgets.fetch.QuoteCache
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import com.algorand.perarn.perawidgets.widgets.portfolioAddresses
import com.algorand.perarn.perawidgets.widgets.portfolioPeriod
import com.algorand.perarn.perawidgets.widgets.portfolioQuoteKey
import com.algorand.perarn.perawidgets.widgets.pricePeriod
import com.algorand.perarn.perawidgets.widgets.priceQuoteCurrency
import com.algorand.perarn.perawidgets.widgets.priceQuoteKey
import java.time.Duration
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

private const val FETCH_TIMEOUT_MS = 15_000L

val QUOTE_FRESH_FOR: Duration = Duration.ofMinutes(5)

// The app rewrites the snapshot on every change, and each rewrite refreshes every widget; a recent quote is reused.
// A fetchedAt ahead of the phone's clock counts as stale, so a clock moved back can't freeze a quote.
fun shouldFetch(cachedFetchedAt: Instant?, now: Instant): Boolean {
    if (cachedFetchedAt == null) return true
    val age = Duration.between(cachedFetchedAt, now)
    return age.isNegative || age >= QUOTE_FRESH_FOR
}

suspend fun refreshPriceQuote(context: Context, widgetId: Int, snapshot: WidgetSnapshot?, options: PriceOptions): Boolean =
    refreshPriceQuote(QuoteCache(context), Http.get, widgetId, snapshot, options)

suspend fun refreshPortfolioQuote(context: Context, widgetId: Int, snapshot: WidgetSnapshot?, options: PortfolioOptions): Boolean =
    refreshPortfolioQuote(QuoteCache(context), Http.get, widgetId, snapshot, options)

// A failed fetch writes nothing: the render then shows the last good quote with its own fetchedAt.
// The key is computed by the same helpers the render reads with, so a quote is never stored where it won't be read.
suspend fun refreshPriceQuote(
    cache: QuoteCache,
    get: HttpGet,
    widgetId: Int,
    snapshot: WidgetSnapshot?,
    options: PriceOptions,
    now: Instant = Instant.now(),
): Boolean {
    val feed = snapshot?.priceFeed ?: return false
    val key = priceQuoteKey(snapshot, options) ?: return false
    if (!shouldFetch(cache.get<PriceQuote>(widgetId, key)?.value?.fetchedAt, now)) return false
    val assetId = resolvePriceAssetId(options, snapshot)
    val quote = priceQuoteCurrency(snapshot, options, assetId) ?: return false
    val fetched = withTimeoutOrNull(FETCH_TIMEOUT_MS) {
        withContext(Dispatchers.IO) { PriceFetcher(get).fetch(feed, assetId, quote, pricePeriod(snapshot, options), now) }
    } ?: return false
    cache.put<PriceQuote>(widgetId, key, fetched)
    return true
}

suspend fun refreshPortfolioQuote(
    cache: QuoteCache,
    get: HttpGet,
    widgetId: Int,
    snapshot: WidgetSnapshot?,
    options: PortfolioOptions,
    now: Instant = Instant.now(),
): Boolean {
    val feed = snapshot?.priceFeed ?: return false
    val key = portfolioQuoteKey(snapshot, options) ?: return false
    if (!shouldFetch(cache.get<PortfolioQuote>(widgetId, key)?.value?.fetchedAt, now)) return false
    val fetched = withTimeoutOrNull(FETCH_TIMEOUT_MS) {
        withContext(Dispatchers.IO) {
            PortfolioFetcher(get).fetch(portfolioAddresses(snapshot, options), portfolioPeriod(snapshot, options), feed, now)
        }
    } ?: return false
    cache.put<PortfolioQuote>(widgetId, key, fetched)
    return true
}
