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
import com.algorand.perarn.perawidgets.fetch.InMemoryStore
import com.algorand.perarn.perawidgets.fetch.PortfolioQuote
import com.algorand.perarn.perawidgets.fetch.PriceQuote
import com.algorand.perarn.perawidgets.fetch.QuoteCache
import com.algorand.perarn.perawidgets.fetch.StubGet
import com.algorand.perarn.perawidgets.fetch.TransactionsQuote
import com.algorand.perarn.perawidgets.format.QuoteCurrency
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import com.algorand.perarn.perawidgets.widgets.portfolioQuoteKey
import com.algorand.perarn.perawidgets.widgets.priceQuoteKey
import com.algorand.perarn.perawidgets.widgets.transactionsContent
import com.algorand.perarn.perawidgets.widgets.transactionsQuoteKey
import java.math.BigDecimal
import java.time.Instant
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class QuoteRefreshTest {
    private val now = Instant.parse("2026-10-27T15:00:00Z")
    private val hourAgo = now.minusSeconds(3600)
    private val widgetId = 7

    private val snapshot = WidgetSnapshot(
        version = 1,
        priceFeed = WidgetSnapshot.PriceFeed("https://api.test", "k", "USD"),
        portfolioFeed = WidgetSnapshot.PortfolioFeed(listOf(WidgetSnapshot.PortfolioFeed.Account("ADDR1")), "one-week"),
    )
    private val priceOptions = PriceOptions()
    private val portfolioOptions = PortfolioOptions()
    private val priceKey = priceQuoteKey(snapshot, priceOptions)!!
    private val portfolioKey = portfolioQuoteKey(snapshot, portfolioOptions)!!

    private val priceRoutes = mapOf("/v1/public/assets/0/" to "{ \"usd_value\": \"0.3\" }")
    private val portfolioRoutes = mapOf("/v1/wallet/wealth/" to "{ \"results\": [{ \"algo_value\": \"12\", \"usd_value\": \"3.6\" }] }")

    private val transactionRoutes = mapOf(
        "/v1/accounts/ADDR1/transactions/" to
            "{ \"results\": [{ \"id\": \"T1\", \"tx_type\": \"pay\", \"round_time\": 1761577200, \"sender\": \"X\", \"receiver\": \"ADDR1\", \"amount\": \"1000000\" }] }",
    )

    private fun oldPrice() = PriceQuote("0", "ALGO", BigDecimal("0.2"), null, emptyList(), QuoteCurrency.Fiat("USD"), hourAgo)
    private fun oldPortfolio() = PortfolioQuote(BigDecimal("10"), BigDecimal("2"), "USD", emptyList(), hourAgo)

    private fun refreshPrice(cache: QuoteCache, stub: StubGet, at: Instant = now) =
        runBlocking { refreshPriceQuote(cache, stub.get, widgetId, snapshot, priceOptions, at) }

    private fun refreshPortfolio(cache: QuoteCache, stub: StubGet, at: Instant = now) =
        runBlocking { refreshPortfolioQuote(cache, stub.get, widgetId, snapshot, portfolioOptions, at) }

    @Test fun aFailedPriceFetchKeepsTheLastGoodQuoteAndItsTime() {
        val cache = QuoteCache(InMemoryStore()).apply { put(widgetId, priceKey, oldPrice()) }
        assertEquals(RefreshOutcome.Failed, refreshPrice(cache, StubGet(emptyMap())))
        assertEquals(oldPrice(), cache.get<PriceQuote>(widgetId, priceKey)!!.value)
    }

    @Test fun aSuccessfulPriceFetchReplacesTheQuote() {
        val cache = QuoteCache(InMemoryStore()).apply { put(widgetId, priceKey, oldPrice()) }
        assertEquals(RefreshOutcome.Stored, refreshPrice(cache, StubGet(priceRoutes)))
        val stored = cache.get<PriceQuote>(widgetId, priceKey)!!.value
        assertEquals(0, BigDecimal("0.3").compareTo(stored.price))
        assertEquals(now, stored.fetchedAt)
    }

    @Test fun aFailedPortfolioFetchKeepsTheLastGoodQuoteAndItsTime() {
        val cache = QuoteCache(InMemoryStore()).apply { put(widgetId, portfolioKey, oldPortfolio()) }
        assertEquals(RefreshOutcome.Failed, refreshPortfolio(cache, StubGet(emptyMap())))
        assertEquals(oldPortfolio(), cache.get<PortfolioQuote>(widgetId, portfolioKey)!!.value)
    }

    @Test fun aSuccessfulPortfolioFetchReplacesTheQuote() {
        val cache = QuoteCache(InMemoryStore()).apply { put(widgetId, portfolioKey, oldPortfolio()) }
        assertEquals(RefreshOutcome.Stored, refreshPortfolio(cache, StubGet(portfolioRoutes)))
        val stored = cache.get<PortfolioQuote>(widgetId, portfolioKey)!!.value
        assertEquals(0, BigDecimal("12").compareTo(stored.algo))
        assertEquals(now, stored.fetchedAt)
    }

    @Test fun aRecentQuoteIsReusedWithoutARequest() {
        val cache = QuoteCache(InMemoryStore()).apply { put(widgetId, priceKey, oldPrice()) }
        val stub = StubGet(priceRoutes)
        assertEquals(RefreshOutcome.Skipped, refreshPrice(cache, stub, at = hourAgo.plusSeconds(4 * 60)))
        assertTrue(stub.requests.isEmpty())
        assertEquals(oldPrice(), cache.get<PriceQuote>(widgetId, priceKey)!!.value)
    }

    @Test fun aDowngradedAssetLosesItsCachedPrice() {
        val options = PriceOptions(assetId = "31566704")
        val s = snapshot.copy(assetOptions = listOf(WidgetSnapshot.AssetOption("31566704", "USDC", "USDC")))
        val key = priceQuoteKey(s, options)!!
        val old = oldPrice().copy(assetId = "31566704", unitName = "USDC")
        val cache = QuoteCache(InMemoryStore()).apply { put(widgetId, key, old) }
        val stub = StubGet(mapOf("/v1/public/assets/31566704/" to "{ \"verification_tier\": \"suspicious\", \"usd_value\": \"1\" }"))
        val outcome = runBlocking { refreshPriceQuote(cache, stub.get, widgetId, s, options, now) }
        assertEquals(RefreshOutcome.Stored, outcome)
        assertNull(cache.get<PriceQuote>(widgetId, key))
    }

    @Test fun transactionsAreStoredWhereTheWidgetReadsThem() {
        val cache = QuoteCache(InMemoryStore())
        val outcome = runBlocking { refreshTransactions(cache, StubGet(transactionRoutes).get, widgetId, snapshot, "ADDR1", now) }
        assertEquals(RefreshOutcome.Stored, outcome)
        val cached = cache.get<TransactionsQuote>(widgetId, transactionsQuoteKey(snapshot, "ADDR1")!!)
        assertEquals(listOf("T1"), transactionsContent(snapshot, "ADDR1", cached)!!.rows!!.map { it.id })
    }

    @Test fun theTabsWidgetStoresBothPagesWhereItReadsThem() {
        val cache = QuoteCache(InMemoryStore())
        val options = PortfolioOptions(accountAddress = "ADDR1")
        val outcomes = runBlocking { refreshTabs(cache, StubGet(portfolioRoutes + transactionRoutes).get, widgetId, snapshot, options, now) }
        assertEquals(listOf(RefreshOutcome.Stored, RefreshOutcome.Stored), outcomes)
        assertNotNull(cache.get<PortfolioQuote>(widgetId, portfolioQuoteKey(snapshot, options)!!))
        assertNotNull(cache.get<TransactionsQuote>(widgetId, transactionsQuoteKey(snapshot, options.accountAddress)!!))
    }

    @Test fun oneFailedTabsPageStillStoresTheOther() {
        val cache = QuoteCache(InMemoryStore())
        val outcomes = runBlocking { refreshTabs(cache, StubGet(portfolioRoutes).get, widgetId, snapshot, PortfolioOptions(), now) }
        assertEquals(listOf(RefreshOutcome.Stored, RefreshOutcome.Failed), outcomes)
    }

    @Test fun privacyModeFetchesNothing() {
        val hidden = snapshot.copy(portfolioFeed = null, portfolio = WidgetSnapshot.Portfolio(state = "hidden"))
        val stub = StubGet(portfolioRoutes + transactionRoutes)
        val outcomes = runBlocking { refreshTabs(QuoteCache(InMemoryStore()), stub.get, widgetId, hidden, PortfolioOptions(), now) }
        assertEquals(listOf(RefreshOutcome.Skipped, RefreshOutcome.Skipped), outcomes)
        assertTrue(stub.requests.isEmpty())
    }

    @Test fun fetchesOnlyWithoutAQuoteYoungerThanFiveMinutes() {
        assertTrue(shouldFetch(null, now))
        assertFalse(shouldFetch(now, now))
        assertFalse(shouldFetch(now.minusSeconds(4 * 60 + 59), now))
        assertTrue(shouldFetch(now.minusSeconds(5 * 60), now))
        assertTrue(shouldFetch(now.plusSeconds(60), now))
    }
}
