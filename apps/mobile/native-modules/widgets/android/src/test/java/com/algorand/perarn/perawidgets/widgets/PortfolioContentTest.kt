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
import com.algorand.perarn.perawidgets.config.PortfolioOptions
import com.algorand.perarn.perawidgets.fetch.Cached
import com.algorand.perarn.perawidgets.fetch.PortfolioQuote
import com.algorand.perarn.perawidgets.format.UpdatedTime
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import java.math.BigDecimal
import java.time.Instant
import java.time.ZoneId
import java.util.Locale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PortfolioContentTest {
    private val t1405 = Instant.parse("2026-10-27T14:05:00Z")
    private val now = Instant.parse("2026-10-27T15:00:00Z")
    private val patterns: (Locale, String) -> String = { _, skeleton ->
        if (skeleton == UpdatedTime.TIME_24) "HH:mm" else "d MMM HH:mm"
    }

    private fun snapshot(
        accounts: List<String> = listOf("A", "B"),
        state: String = "ready",
        formatted: String = "$1,234.56",
        algoFormatted: String = "6,000.00 ALGO",
        asOf: Double? = null,
    ) = WidgetSnapshot(
        version = 1,
        locale = "en-US",
        strings = mapOf("portfolio" to "Portfolio", "updated" to "Updated"),
        network = WidgetSnapshot.Network(isMainnet = true, label = "MainNet"),
        priceFeed = WidgetSnapshot.PriceFeed("https://api.test", "k", "USD"),
        portfolioFeed = WidgetSnapshot.PortfolioFeed(
            accounts = accounts.map { WidgetSnapshot.PortfolioFeed.Account(it, "Name $it") },
            period = "one-week",
        ),
        portfolio = WidgetSnapshot.Portfolio(state, formatted, algoFormatted, asOf),
    )

    private fun quote(
        algo: String = "6500.1",
        fiat: String? = "1500.5",
        currency: String = "USD",
        chart: List<Double> = listOf(1.0, 2.0, 3.0),
        fetchedAt: Instant = t1405,
    ) = PortfolioQuote(BigDecimal(algo), fiat?.let { BigDecimal(it) }, currency, chart, fetchedAt)

    private fun content(
        snapshot: WidgetSnapshot,
        options: PortfolioOptions = PortfolioOptions(),
        quote: PortfolioQuote? = null,
    ) = portfolioContent(snapshot, options, quote?.let { Cached(it) }, now, Locale.US, ZoneId.of("UTC"), is24Hour = true, patterns)

    @Test fun privacyModeMasksEvenWithACachedQuote() {
        val c = content(snapshot(state = "hidden"), quote = quote())
        assertEquals("••••", c.primary)
        assertNull(c.secondary)
        assertNull(c.chart)
        assertNull(c.updatedText)
    }

    @Test fun usesTheQuoteAndItsFetchTime() {
        val c = content(snapshot(), quote = quote())
        assertEquals("6,500.10 ALGO", c.primary)
        assertEquals("≈ $1,500.50", c.secondary)
        assertEquals("Updated 14:05", c.updatedText)
        assertEquals(listOf(1.0, 2.0, 3.0), c.chart)
        assertTrue(c.isTrendUp)
    }

    @Test fun fallsBackToTheSnapshotTotalForAllAccounts() {
        val c = content(snapshot(asOf = t1405.toEpochMilli().toDouble()))
        assertEquals("6,000.00 ALGO", c.primary)
        assertEquals("≈ $1,234.56", c.secondary)
        assertEquals("Updated 14:05", c.updatedText)
        assertNull(c.chart)
    }

    @Test fun aSingleAccountWithoutAQuoteShowsNothing() {
        val c = content(snapshot(asOf = 1.0), PortfolioOptions(accountAddress = "A"))
        assertNull(c.primary)
        assertNull(c.secondary)
        assertNull(c.updatedText)
        assertEquals("Name A", c.title)
    }

    @Test fun anAccountTheAppNoLongerSharesFallsBackToAll() {
        val c = content(snapshot(), PortfolioOptions(accountAddress = "GONE"))
        assertEquals("Portfolio", c.title)
        assertEquals("6,000.00 ALGO", c.primary)
        assertEquals("perawallet://app/portfolio/", c.tapUrl)
    }

    @Test fun skipsTheSecondLineWhenItRepeatsTheFirst() {
        val c = content(snapshot(formatted = "6,000.00 ALGO"))
        assertNull(c.secondary)
    }

    @Test fun skipsTheSecondLineWithoutAFiatValue() {
        assertNull(content(snapshot(), quote = quote(fiat = null)).secondary)
    }

    @Test fun tapsOpenTheAccountOrThePortfolio() {
        assertEquals(
            "perawallet://app/account-detail/?address=A",
            content(snapshot(), PortfolioOptions(accountAddress = "A")).tapUrl,
        )
        assertEquals("perawallet://app/portfolio/", content(snapshot()).tapUrl)
    }

    @Test fun hidesTheChartWhenTurnedOffOrTooShort() {
        assertNull(content(snapshot(), PortfolioOptions(showChart = false), quote()).chart)
        assertNull(content(snapshot(), quote = quote(chart = listOf(1.0))).chart)
    }

    @Test fun aFallingChartIsNotUp() {
        assertFalse(content(snapshot(), quote = quote(chart = listOf(3.0, 1.0))).isTrendUp)
    }

    @Test fun theCacheKeyFollowsTheAccountsAndPeriod() {
        val s = snapshot()
        assertEquals(
            "portfolio|https://api.test|A,B|one-week|USD",
            portfolioQuoteKey(s, PortfolioOptions()),
        )
        assertEquals(
            "portfolio|https://api.test|A|one-day|USD",
            portfolioQuoteKey(s, PortfolioOptions(period = Period.Day, accountAddress = "A")),
        )
    }

    @Test fun noPortfolioFeedMeansNoCacheKey() {
        assertNull(portfolioQuoteKey(snapshot().copy(portfolioFeed = null), PortfolioOptions()))
    }
}
