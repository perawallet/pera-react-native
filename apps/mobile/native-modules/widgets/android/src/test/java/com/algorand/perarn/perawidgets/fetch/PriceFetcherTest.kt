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
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PriceFetcherTest {
    private fun asset(tier: String?, usd: String, previous: String? = null, unit: String = "USDC"): String {
        val tierField = tier?.let { "\"verification_tier\": \"$it\"," }.orEmpty()
        val previousField = previous?.let { "\"usd_value_24_hour_ago\": \"$it\"," }.orEmpty()
        return "{ $tierField $previousField \"unit_name\": \"$unit\", \"usd_value\": \"$usd\" }"
    }

    private val eur = "/v1/currencies/EUR/" to "{ \"usd_value\": \"0.9\" }"

    private fun fetch(
        routes: Map<String, String?>,
        assetId: String,
        quote: QuoteCurrency,
        period: String = "one-week",
        currency: String = "USD",
    ): Pair<PriceQuote?, StubGet> {
        val stub = StubGet(routes)
        val result = runBlocking { PriceFetcher(stub.get).fetch(feed(currency), assetId, quote, period) }
        return result to stub
    }

    @Test fun pricesAVerifiedAssetInTheChosenFiatCurrency() {
        val (q, _) = fetch(
            mapOf(
                "/v1/public/assets/31566704/" to asset("verified", "1.0", "0.98"),
                eur,
                "/v1/assets/price-chart/" to "[{ \"price\": 1.0 }, { \"price\": 1.01 }]",
            ),
            "31566704", QuoteCurrency.Fiat("EUR"),
        )
        q!!
        assertEquals(0, BigDecimal("0.9").compareTo(q.price))
        assertEquals("USDC", q.unitName)
        assertEquals((1.0 - 0.98) / 0.98, q.change24h!!, 1e-9)
        assertEquals(2, q.chart.size)
        assertEquals(1.01 * 0.9, q.chart[1], 1e-9)
    }

    @Test fun pricesAlgoInFiat() {
        val (q, _) = fetch(
            mapOf("/v1/public/assets/0/" to asset(null, "0.2", "0.25", ""), eur),
            "0", QuoteCurrency.Fiat("EUR"), currency = "EUR",
        )
        q!!
        assertEquals(BigDecimal("0.18"), q.price.stripTrailingZeros())
        assertEquals(-0.2, q.change24h!!, 1e-9)
        assertEquals("ALGO", q.unitName)
    }

    @Test fun refusesAnAssetNoLongerVerified() {
        val (q, _) = fetch(mapOf("/v1/public/assets/31566704/" to asset("unverified", "1.0")), "31566704", QuoteCurrency.Fiat("USD"))
        assertNull(q)
    }

    @Test fun refusesASuspiciousAsset() {
        val (q, _) = fetch(mapOf("/v1/public/assets/999/" to asset("suspicious", "1.0"), eur), "999", QuoteCurrency.Fiat("EUR"))
        assertNull(q)
    }

    @Test fun refusesAnAssetWithNoTier() {
        val (q, _) = fetch(mapOf("/v1/public/assets/999/" to asset(null, "1.0"), eur), "999", QuoteCurrency.Fiat("EUR"))
        assertNull(q)
    }

    @Test fun acceptsATrustedAsset() {
        val (q, _) = fetch(mapOf("/v1/public/assets/31566704/" to asset("trusted", "1.0"), eur), "31566704", QuoteCurrency.Fiat("EUR"))
        assertNotNull(q)
    }

    @Test fun quotesInAlgoByDividingByTheAlgoPrice() {
        val (q, _) = fetch(
            mapOf(
                "/v1/public/assets/31566704/" to asset("verified", "1.0"),
                "/v1/public/assets/0/" to asset(null, "0.2", unit = ""),
            ),
            "31566704", QuoteCurrency.Algo,
        )
        q!!
        assertEquals(0, BigDecimal(5).compareTo(q.price))
        assertEquals(QuoteCurrency.Algo, q.quote)
    }

    @Test fun makesNoCurrencyRequestForUsd() {
        val (_, stub) = fetch(mapOf("/v1/public/assets/0/" to asset(null, "0.2", unit = "")), "0", QuoteCurrency.Fiat("USD"))
        assertTrue(stub.requests.none { it.first.contains("/v1/currencies/") })
    }

    @Test fun hasNoChangeWhenThePreviousPriceIsZero() {
        val (q, _) = fetch(mapOf("/v1/public/assets/0/" to asset(null, "0.2", "0", "")), "0", QuoteCurrency.Fiat("USD"))
        assertNull(q!!.change24h)
    }

    @Test fun acceptsNumbersWhereTheBackendSendsThem() {
        val (q, _) = fetch(mapOf("/v1/public/assets/0/" to "{ \"usd_value\": 0.25 }"), "0", QuoteCurrency.Fiat("USD"))
        assertEquals(0, BigDecimal("0.25").compareTo(q!!.price))
    }

    @Test fun stillPricesWhenTheChartFails() {
        val (q, _) = fetch(
            mapOf("/v1/public/assets/0/" to asset(null, "0.2", unit = ""), "/v1/assets/price-chart/" to null),
            "0", QuoteCurrency.Fiat("USD"),
        )
        assertEquals(emptyList<Double>(), q!!.chart)
    }

    @Test fun failsWithoutACurrencyRate() {
        val (q, _) = fetch(mapOf("/v1/public/assets/0/" to asset(null, "0.2", unit = "")), "0", QuoteCurrency.Fiat("EUR"), currency = "EUR")
        assertNull(q)
    }

    @Test fun anyFailureIsNull() {
        val (q, _) = fetch(emptyMap(), "0", QuoteCurrency.Fiat("USD"))
        assertNull(q)
    }

    @Test fun malformedJsonIsNull() {
        val (q, _) = fetch(mapOf("/v1/public/assets/0/" to "not json"), "0", QuoteCurrency.Fiat("USD"))
        assertNull(q)
    }

    @Test fun sendsTheApiKeyAndChartPeriod() {
        val (_, stub) = fetch(mapOf("/v1/public/assets/0/" to asset(null, "0.2", unit = "")), "0", QuoteCurrency.Fiat("USD"), period = "one-month")
        assertTrue(stub.requests.all { it.second == "test-key" })
        assertTrue(stub.requests.any { it.first.contains("period=one-month") })
    }

    @Test fun missingBackendUrlIsNull() {
        val stub = StubGet(emptyMap())
        val q = runBlocking { PriceFetcher(stub.get).fetch(feed("USD", backend = null), "0", QuoteCurrency.Fiat("USD"), "one-week") }
        assertNull(q)
        assertTrue(stub.requests.isEmpty())
    }
}
