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
import com.algorand.perarn.perawidgets.format.QuoteCurrency
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import com.algorand.perarn.perawidgets.widgets.portfolioQuoteKey
import com.algorand.perarn.perawidgets.widgets.priceQuoteKey
import java.math.BigDecimal
import java.time.Instant
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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

    private fun oldPrice() = PriceQuote("0", "ALGO", BigDecimal("0.2"), null, emptyList(), QuoteCurrency.Fiat("USD"), hourAgo)
    private fun oldPortfolio() = PortfolioQuote(BigDecimal("10"), BigDecimal("2"), "USD", emptyList(), hourAgo)

    private fun refreshPrice(cache: QuoteCache, stub: StubGet, at: Instant = now) =
        runBlocking { refreshPriceQuote(cache, stub.get, widgetId, snapshot, priceOptions, at) }

    private fun refreshPortfolio(cache: QuoteCache, stub: StubGet, at: Instant = now) =
        runBlocking { refreshPortfolioQuote(cache, stub.get, widgetId, snapshot, portfolioOptions, at) }

    @Test fun aFailedPriceFetchKeepsTheLastGoodQuoteAndItsTime() {
        val cache = QuoteCache(InMemoryStore()).apply { put(widgetId, priceKey, oldPrice()) }
        assertFalse(refreshPrice(cache, StubGet(emptyMap())))
        assertEquals(oldPrice(), cache.get<PriceQuote>(widgetId, priceKey)!!.value)
    }

    @Test fun aSuccessfulPriceFetchReplacesTheQuote() {
        val cache = QuoteCache(InMemoryStore()).apply { put(widgetId, priceKey, oldPrice()) }
        assertTrue(refreshPrice(cache, StubGet(priceRoutes)))
        val stored = cache.get<PriceQuote>(widgetId, priceKey)!!.value
        assertEquals(0, BigDecimal("0.3").compareTo(stored.price))
        assertEquals(now, stored.fetchedAt)
    }

    @Test fun aFailedPortfolioFetchKeepsTheLastGoodQuoteAndItsTime() {
        val cache = QuoteCache(InMemoryStore()).apply { put(widgetId, portfolioKey, oldPortfolio()) }
        assertFalse(refreshPortfolio(cache, StubGet(emptyMap())))
        assertEquals(oldPortfolio(), cache.get<PortfolioQuote>(widgetId, portfolioKey)!!.value)
    }

    @Test fun aSuccessfulPortfolioFetchReplacesTheQuote() {
        val cache = QuoteCache(InMemoryStore()).apply { put(widgetId, portfolioKey, oldPortfolio()) }
        assertTrue(refreshPortfolio(cache, StubGet(portfolioRoutes)))
        val stored = cache.get<PortfolioQuote>(widgetId, portfolioKey)!!.value
        assertEquals(0, BigDecimal("12").compareTo(stored.algo))
        assertEquals(now, stored.fetchedAt)
    }

    @Test fun aRecentQuoteIsReusedWithoutARequest() {
        val cache = QuoteCache(InMemoryStore()).apply { put(widgetId, priceKey, oldPrice()) }
        val stub = StubGet(priceRoutes)
        assertFalse(refreshPrice(cache, stub, at = hourAgo.plusSeconds(4 * 60)))
        assertTrue(stub.requests.isEmpty())
        assertEquals(oldPrice(), cache.get<PriceQuote>(widgetId, priceKey)!!.value)
    }

    @Test fun fetchesOnlyWithoutAQuoteYoungerThanFiveMinutes() {
        assertTrue(shouldFetch(null, now))
        assertFalse(shouldFetch(now, now))
        assertFalse(shouldFetch(now.minusSeconds(4 * 60 + 59), now))
        assertTrue(shouldFetch(now.minusSeconds(5 * 60), now))
        assertTrue(shouldFetch(now.plusSeconds(60), now))
    }
}
