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

import com.algorand.perarn.perawidgets.format.QuoteCurrency
import java.math.BigDecimal
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class QuoteCacheTest {
    private val t0 = Instant.ofEpochMilli(1_700_000_000_123)
    private val cache = QuoteCache(InMemoryStore())

    private fun quote(fetchedAt: Instant = t0, quote: QuoteCurrency = QuoteCurrency.Fiat("EUR")) = PriceQuote(
        assetId = "0", unitName = "ALGO", price = BigDecimal("0.123456789012345678"), change24h = -0.2,
        chart = listOf(1.0, 2.5), quote = quote, fetchedAt = fetchedAt,
    )

    private fun priceKey(backend: String = "https://mainnet", currency: String = "EUR", period: String = "one-week") =
        QuoteKeys.price(backend, "0", period, QuoteCurrency.Fiat(currency))

    @Test fun cacheKeepsTheLastGoodQuoteWithItsTime() {
        val stored = quote()
        cache.put(1, priceKey(), stored)
        val read = cache.get<PriceQuote>(1, priceKey())!!.value
        assertEquals(stored, read)
        assertEquals(t0, read.fetchedAt)
    }

    @Test fun roundTripsAlgoQuoteAndExactDecimal() {
        cache.put(1, "k", quote(quote = QuoteCurrency.Algo))
        val read = cache.get<PriceQuote>(1, "k")!!.value
        assertEquals(QuoteCurrency.Algo, read.quote)
        assertEquals(BigDecimal("0.123456789012345678"), read.price)
    }

    @Test fun roundTripsAPortfolioQuote() {
        val p = PortfolioQuote(BigDecimal("12.5"), null, "EUR", listOf(1.0), t0)
        cache.put(2, "p", p)
        assertEquals(p, cache.get<PortfolioQuote>(2, "p")!!.value)
    }

    @Test fun cacheNeverServesAnotherKey() {
        cache.put(1, priceKey(), quote())
        assertNull(cache.get<PriceQuote>(1, priceKey(backend = "https://testnet")))
        assertNull(cache.get<PriceQuote>(1, priceKey(currency = "USD")))
        assertNull(cache.get<PriceQuote>(1, priceKey(period = "one-day")))
    }

    @Test fun neverServesAnotherWidget() {
        cache.put(1, "k", quote())
        assertNull(cache.get<PriceQuote>(2, "k"))
    }

    @Test fun portfolioKeyIgnoresAddressOrderButNotTheSet() {
        val ab = QuoteKeys.portfolio("u", listOf("A", "B"), "one-week", "EUR")
        assertEquals(ab, QuoteKeys.portfolio("u", listOf("B", "A"), "one-week", "EUR"))
        assert(ab != QuoteKeys.portfolio("u", listOf("A"), "one-week", "EUR"))
        assert(ab != QuoteKeys.portfolio("u", listOf("A", "B"), "one-week", "USD"))
    }

    @Test fun corruptEntryReadsAsMiss() {
        val store = InMemoryStore()
        store.put("quote.1.k", "garbage")
        assertNull(QuoteCache(store).get<PriceQuote>(1, "k"))
    }
}
