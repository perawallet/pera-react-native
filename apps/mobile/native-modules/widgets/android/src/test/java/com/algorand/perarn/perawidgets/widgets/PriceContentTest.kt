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
package com.algorand.perarn.perawidgets.widgets

import com.algorand.perarn.perawidgets.config.Period
import com.algorand.perarn.perawidgets.config.PriceOptions
import com.algorand.perarn.perawidgets.fetch.Cached
import com.algorand.perarn.perawidgets.fetch.PriceQuote
import com.algorand.perarn.perawidgets.format.QuoteCurrency
import com.algorand.perarn.perawidgets.format.UpdatedTime
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import java.math.BigDecimal
import java.time.Instant
import java.time.ZoneId
import java.util.Locale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PriceContentTest {
    private val t1405 = Instant.parse("2026-10-27T14:05:00Z")
    private val now = Instant.parse("2026-10-27T15:00:00Z")
    private val patterns: (Locale, String) -> String = { _, skeleton ->
        if (skeleton == UpdatedTime.TIME_24) "HH:mm" else "d MMM HH:mm"
    }

    private fun snapshot(hasAlgoPrice: Boolean = true, privacyHidden: Boolean = false) = WidgetSnapshot(
        version = 1,
        locale = "en-US",
        strings = mapOf("algoPrice" to "ALGO Price", "updated" to "Updated"),
        network = WidgetSnapshot.Network(isMainnet = true, label = "MainNet"),
        priceFeed = WidgetSnapshot.PriceFeed("https://api.test", "k", "USD"),
        assetOptions = listOf(WidgetSnapshot.AssetOption("31566704", "USDC", "USDC")),
        algoPrice = if (hasAlgoPrice) WidgetSnapshot.Price("$0.23", t1405.toEpochMilli().toDouble()) else null,
        portfolio = WidgetSnapshot.Portfolio(state = if (privacyHidden) "hidden" else "ready"),
    )

    private fun quote(
        assetId: String = "0",
        unit: String = "ALGO",
        price: String = "0.2341",
        change: Double? = -0.023,
        quote: QuoteCurrency = QuoteCurrency.Fiat("USD"),
    ) = PriceQuote(assetId, unit, BigDecimal(price), change, listOf(1.0, 2.0), quote, t1405)

    private fun content(
        options: PriceOptions = PriceOptions(),
        quote: PriceQuote? = null,
        snapshot: WidgetSnapshot = snapshot(),
    ) = priceContent(snapshot, options, quote?.let { Cached(it) }, now, Locale.US, ZoneId.of("UTC"), is24Hour = true, patterns)

    @Test fun fallsBackToTheAppsAlgoPriceWithoutAQuote() {
        val c = content()
        assertEquals("$0.23", c.price)
        assertEquals("ALGO Price", c.title)
        assertEquals("Updated 14:05", c.updatedText)
        assertNull(c.change)
        assertNull(c.chart)
    }

    @Test fun theAppsAlgoPriceIsNotAFallbackForAnotherCurrency() {
        assertNull(content(PriceOptions(currencyCode = "EUR")).price)
    }

    @Test fun showsTheChangeWithAnArrowAndUnsignedPercent() {
        val c = content(quote = quote(change = -0.023))
        assertEquals("▼ 2.3% 24h", c.change)
        assertEquals("$0.2341", c.price)
        assertEquals(false, c.isTrendUp)
        assertEquals("▲ 3.2% 24h", content(quote = quote(change = 0.032)).change)
    }

    @Test fun showsAssetPerCurrencyOnlyWhenChosen() {
        assertEquals("1 USD = 4.27 ALGO", content(quote = quote()).inverse)
        assertNull(content(PriceOptions(showAssetPerCurrency = false), quote()).inverse)
    }

    @Test fun usesTheQuoteFetchTimeForUpdated() {
        val older = quote().copy(fetchedAt = Instant.parse("2026-10-27T13:30:00Z"))
        assertEquals("Updated 13:30", content(quote = older).updatedText)
    }

    @Test fun aNonAlgoAssetWithoutAQuoteShowsNoPrice() {
        val c = content(PriceOptions(assetId = "31566704"))
        assertNull(c.price)
        assertNull(c.updatedText)
        assertEquals("USDC", c.title)
        assertEquals("ID 31566704", c.assetIdLine)
    }

    @Test fun anAssetTheAppNoLongerSharesFallsBackToAlgo() {
        val c = content(PriceOptions(assetId = "999"))
        assertEquals("ALGO Price", c.title)
        assertNull(c.assetIdLine)
    }

    @Test fun priceShowsInPrivacyMode() {
        assertEquals("$0.2341", content(quote = quote(), snapshot = snapshot(privacyHidden = true)).price)
    }

    @Test fun quoteCurrencyFollowsIos() {
        val s = snapshot()
        assertEquals(QuoteCurrency.Fiat("USD"), priceQuoteCurrency(s, PriceOptions(), "0"))
        assertEquals(QuoteCurrency.Fiat("USD"), priceQuoteCurrency(s, PriceOptions(currencyCode = "ALGO"), "0"))
        assertEquals(QuoteCurrency.Algo, priceQuoteCurrency(s, PriceOptions(currencyCode = "ALGO"), "31566704"))
        assertEquals(QuoteCurrency.Fiat("EUR"), priceQuoteCurrency(s, PriceOptions(currencyCode = "EUR"), "0"))
    }

    @Test fun quoteKeyUsesTheResolvedAsset() {
        val s = snapshot()
        assertEquals(priceQuoteKey(s, PriceOptions(assetId = "999")), priceQuoteKey(s, PriceOptions()))
        assertTrue(priceQuoteKey(s, PriceOptions(period = Period.Day))!!.contains("one-day"))
    }

    @Test fun aMissingOrBlankAppCurrencyGivesNoQuoteKeyAndFallsBackToTheAppPrice() {
        for (code in listOf(null, "", " ")) {
            val s = snapshot().copy(priceFeed = WidgetSnapshot.PriceFeed("https://api.test", "k", code))
            assertNull(priceQuoteCurrency(s, PriceOptions(), "0"))
            assertNull(priceQuoteKey(s, PriceOptions()))
            assertEquals("$0.23", content(snapshot = s).price)
        }
    }
}
