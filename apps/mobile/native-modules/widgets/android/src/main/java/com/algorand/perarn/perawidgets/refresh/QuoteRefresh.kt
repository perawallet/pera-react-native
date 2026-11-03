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

import com.algorand.perarn.perawidgets.config.PortfolioOptions
import com.algorand.perarn.perawidgets.config.PriceOptions
import com.algorand.perarn.perawidgets.config.resolvePriceAssetId
import com.algorand.perarn.perawidgets.fetch.HttpGet
import com.algorand.perarn.perawidgets.fetch.PortfolioFetcher
import com.algorand.perarn.perawidgets.fetch.PortfolioQuote
import com.algorand.perarn.perawidgets.fetch.PriceFetch
import com.algorand.perarn.perawidgets.fetch.PriceFetcher
import com.algorand.perarn.perawidgets.fetch.PriceQuote
import com.algorand.perarn.perawidgets.fetch.QuoteCache
import com.algorand.perarn.perawidgets.fetch.TransactionsFetcher
import com.algorand.perarn.perawidgets.fetch.TransactionsQuote
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import com.algorand.perarn.perawidgets.widgets.TRANSACTIONS_FETCH_LIMIT
import com.algorand.perarn.perawidgets.widgets.portfolioAddresses
import com.algorand.perarn.perawidgets.widgets.portfolioPeriod
import com.algorand.perarn.perawidgets.widgets.portfolioQuoteKey
import com.algorand.perarn.perawidgets.widgets.pricePeriod
import com.algorand.perarn.perawidgets.widgets.priceQuoteCurrency
import com.algorand.perarn.perawidgets.widgets.priceQuoteKey
import com.algorand.perarn.perawidgets.widgets.snapshotLocale
import com.algorand.perarn.perawidgets.widgets.transactionsAddresses
import com.algorand.perarn.perawidgets.widgets.transactionsQuoteKey
import java.time.Duration
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

private const val FETCH_TIMEOUT_MS = 15_000L

val QUOTE_FRESH_FOR: Duration = Duration.ofMinutes(5)

enum class RefreshOutcome {
    // A new quote is on disk (or an untrusted one was removed): the widget needs a redraw.
    Stored,

    // Nothing to fetch: a fresh quote, or nothing this widget can fetch for.
    Skipped,

    // The fetch failed or timed out; the last good quote stays and a retry is due.
    Failed,
}

// The app rewrites the snapshot on every change, and each rewrite refreshes every widget; a recent quote is reused.
// A fetchedAt ahead of the phone's clock counts as stale, so a clock moved back can't freeze a quote.
fun shouldFetch(cachedFetchedAt: Instant?, now: Instant): Boolean {
    if (cachedFetchedAt == null) return true
    val age = Duration.between(cachedFetchedAt, now)
    return age.isNegative || age >= QUOTE_FRESH_FOR
}

// A failed fetch writes nothing: the render then shows the last good quote with its own fetchedAt.
// The key is computed by the same helpers the render reads with, so a quote is never stored where it won't be read.
suspend fun refreshPriceQuote(
    cache: QuoteCache,
    get: HttpGet,
    widgetId: Int,
    snapshot: WidgetSnapshot?,
    options: PriceOptions,
    now: Instant = Instant.now(),
): RefreshOutcome {
    val feed = snapshot?.priceFeed ?: return RefreshOutcome.Skipped
    val key = priceQuoteKey(snapshot, options) ?: return RefreshOutcome.Skipped
    if (!shouldFetch(cache.get<PriceQuote>(widgetId, key)?.value?.fetchedAt, now)) return RefreshOutcome.Skipped
    val assetId = resolvePriceAssetId(options, snapshot)
    val quote = priceQuoteCurrency(snapshot, options, assetId) ?: return RefreshOutcome.Skipped
    val fetched = withTimeoutOrNull(FETCH_TIMEOUT_MS) {
        withContext(Dispatchers.IO) { PriceFetcher(get).fetch(feed, assetId, quote, pricePeriod(snapshot, options), now) }
    }
    return when (fetched) {
        is PriceFetch.Fetched -> {
            cache.put<PriceQuote>(widgetId, key, fetched.quote)
            RefreshOutcome.Stored
        }
        // A downgraded asset shows no price rather than its last one beside the verified badge.
        PriceFetch.Untrusted -> {
            cache.remove(widgetId, key)
            RefreshOutcome.Stored
        }
        PriceFetch.Failed, null -> RefreshOutcome.Failed
    }
}

suspend fun refreshPortfolioQuote(
    cache: QuoteCache,
    get: HttpGet,
    widgetId: Int,
    snapshot: WidgetSnapshot?,
    options: PortfolioOptions,
    now: Instant = Instant.now(),
): RefreshOutcome {
    val feed = snapshot?.priceFeed ?: return RefreshOutcome.Skipped
    val key = portfolioQuoteKey(snapshot, options) ?: return RefreshOutcome.Skipped
    if (!shouldFetch(cache.get<PortfolioQuote>(widgetId, key)?.value?.fetchedAt, now)) return RefreshOutcome.Skipped
    val fetched = withTimeoutOrNull(FETCH_TIMEOUT_MS) {
        withContext(Dispatchers.IO) {
            PortfolioFetcher(get).fetch(portfolioAddresses(snapshot, options), portfolioPeriod(snapshot, options), feed, now)
        }
    } ?: return RefreshOutcome.Failed
    cache.put<PortfolioQuote>(widgetId, key, fetched)
    return RefreshOutcome.Stored
}

suspend fun refreshTransactions(
    cache: QuoteCache,
    get: HttpGet,
    widgetId: Int,
    snapshot: WidgetSnapshot?,
    accountAddress: String?,
    now: Instant = Instant.now(),
): RefreshOutcome {
    val feed = snapshot?.priceFeed ?: return RefreshOutcome.Skipped
    val key = transactionsQuoteKey(snapshot, accountAddress) ?: return RefreshOutcome.Skipped
    if (!shouldFetch(cache.get<TransactionsQuote>(widgetId, key)?.value?.fetchedAt, now)) return RefreshOutcome.Skipped
    val fetched = withTimeoutOrNull(FETCH_TIMEOUT_MS) {
        withContext(Dispatchers.IO) {
            TransactionsFetcher(get).fetch(
                transactionsAddresses(snapshot, accountAddress),
                TRANSACTIONS_FETCH_LIMIT,
                feed,
                snapshotLocale(snapshot),
                now,
            )
        }
    } ?: return RefreshOutcome.Failed
    cache.put<TransactionsQuote>(widgetId, key, fetched)
    return RefreshOutcome.Stored
}


// The tabs widget's two pages, both fetched (not short-circuited): each has its own data, read with the same
// account option.
suspend fun refreshTabs(
    cache: QuoteCache,
    get: HttpGet,
    widgetId: Int,
    snapshot: WidgetSnapshot?,
    options: PortfolioOptions,
    now: Instant = Instant.now(),
): List<RefreshOutcome> = listOf(
    refreshPortfolioQuote(cache, get, widgetId, snapshot, options, now),
    refreshTransactions(cache, get, widgetId, snapshot, options.accountAddress, now),
)
