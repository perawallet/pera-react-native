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

import com.algorand.perarn.perawidgets.fetch.Cached
import com.algorand.perarn.perawidgets.fetch.TransactionKind
import com.algorand.perarn.perawidgets.fetch.TransactionRow
import com.algorand.perarn.perawidgets.fetch.TransactionsQuote
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TransactionsContentTest {
    private val now = Instant.parse("2026-11-03T12:00:00Z")

    private fun snapshot(hasFeed: Boolean = true, locale: String = "en") = WidgetSnapshot(
        version = 1,
        locale = locale,
        strings = mapOf("recentTransactions" to "Last transactions", "noTransactions" to "No transactions available", "txSend" to "Send"),
        priceFeed = WidgetSnapshot.PriceFeed(backendUrl = "https://api.test", currencyCode = "USD"),
        portfolioFeed = if (hasFeed) {
            WidgetSnapshot.PortfolioFeed(
                accounts = listOf(WidgetSnapshot.PortfolioFeed.Account("A", "Main"), WidgetSnapshot.PortfolioFeed.Account("B", "Savings")),
            )
        } else {
            null
        },
    )

    @Test fun privacyModeShowsNothing() {
        assertNull(transactionsContent(snapshot(hasFeed = false), null, null))
        assertNull(transactionsQuoteKey(snapshot(hasFeed = false), null))
    }

    @Test fun everyAccountOpensThePortfolio() {
        val content = transactionsContent(snapshot(), null, null)!!
        assertEquals("Last transactions", content.title)
        assertEquals("perawallet://app/portfolio/", content.tapUrl)
        assertEquals(listOf("A", "B"), transactionsAddresses(snapshot(), null))
    }

    @Test fun oneAccountIsTitledByItsNameAndOpensItsHistory() {
        val content = transactionsContent(snapshot(), "B", null)!!
        assertEquals("Savings", content.title)
        assertEquals("perawallet://app/account-detail/?address=B&tab=history", content.tapUrl)
        assertEquals(listOf("B"), transactionsAddresses(snapshot(), "B"))
    }

    @Test fun aRemovedAccountFallsBackToEveryAccount() {
        assertEquals(listOf("A", "B"), transactionsAddresses(snapshot(), "GONE"))
        assertEquals("Last transactions", transactionsContent(snapshot(), "GONE", null)!!.title)
    }

    @Test fun rowsComeFromTheCache() {
        val rows = listOf(TransactionRow("1", TransactionKind.Send, "1 ALGO", now))
        assertEquals(rows, transactionsContent(snapshot(), null, Cached(TransactionsQuote(rows, now)))!!.rows)
    }

    @Test fun theLocaleIsPartOfTheCacheKey() {
        assertNotEquals(transactionsQuoteKey(snapshot(locale = "en"), null), transactionsQuoteKey(snapshot(locale = "pt-BR"), null))
    }

    @Test fun theSignFollowsTheDirection() {
        assertEquals("−1 ALGO", signedAmount(TransactionRow("1", TransactionKind.Send, "1 ALGO", now)))
        assertEquals("+1 ALGO", signedAmount(TransactionRow("1", TransactionKind.Receive, "1 ALGO", now)))
        assertEquals("USDC → ALGO", signedAmount(TransactionRow("1", TransactionKind.Swap, "USDC → ALGO", now)))
        assertNull(signedAmount(TransactionRow("1", TransactionKind.OptIn, null, now)))
    }
}
