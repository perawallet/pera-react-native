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

import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PortfolioTabsContentTest {
    private fun snapshot(hidden: Boolean = false, isMainnet: Boolean = true) = WidgetSnapshot(
        version = 1,
        network = WidgetSnapshot.Network(isMainnet = isMainnet, label = "TestNet"),
        portfolio = WidgetSnapshot.Portfolio(state = if (hidden) "hidden" else "visible"),
    )

    private val portfolio = PortfolioContent("Portfolio", "6,500.10 ALGO", "≈ $ 1,500.50", listOf(1.0, 2.0), true, "Updated 14:05", "perawallet://app/portfolio/")
    private val transactions = TransactionsContent("Last transactions", emptyList(), "No transactions available", "perawallet://app/account-detail/?address=A&tab=history")

    private fun tabs(page: Int = PORTFOLIO_PAGE, width: Float = 160f, height: Float = 150f, hidden: Boolean = false, isMainnet: Boolean = true) =
        tabsContent(snapshot(hidden, isMainnet), portfolio, transactions, page, width, height)

    @Test fun privacyModeHasNoTabs() {
        val t = tabs(page = TRANSACTIONS_PAGE, hidden = true)
        assertEquals(TabsMode.PortfolioOnly, t.mode)
        assertNull(t.transactions)
        assertEquals(portfolio.tapUrl, t.tapUrl)
        assertEquals(150f, t.pageHeightDp)
    }

    @Test fun noFeedHasNoTabs() =
        assertEquals(TabsMode.PortfolioOnly, tabsContent(snapshot(), portfolio, null, TRANSACTIONS_PAGE, 160f, 150f).mode)

    @Test fun aWideWidgetShowsBothSideBySide() {
        val t = tabs(page = TRANSACTIONS_PAGE, width = 250f)
        assertEquals(TabsMode.SideBySide, t.mode)
        assertFalse(t.showsTransactions)
        assertEquals(150f, t.pageHeightDp)
    }

    @Test fun onlyAWideWidgetGivesTheTransactionsHalfItsOwnLink() {
        val wide = tabs(page = TRANSACTIONS_PAGE, width = 250f)
        assertEquals(portfolio.tapUrl, wide.tapUrl)
        assertEquals(transactions.tapUrl, wide.transactionsHalfTapUrl)
        assertNull(tabs(page = TRANSACTIONS_PAGE).transactionsHalfTapUrl)
        assertNull(tabs(page = TRANSACTIONS_PAGE, hidden = true).transactionsHalfTapUrl)
    }

    @Test fun theSelectedTabDecidesThePageAndTheTap() {
        val tx = tabs(page = TRANSACTIONS_PAGE)
        assertEquals(TabsMode.Tabs, tx.mode)
        assertTrue(tx.showsTransactions)
        assertEquals(transactions.tapUrl, tx.tapUrl)
        assertEquals(150f - TAB_BAR_DP, tx.pageHeightDp)
        assertEquals(portfolio.tapUrl, tabs(page = PORTFOLIO_PAGE).tapUrl)
    }

    @Test fun aPageWithNoRoomForARowDropsTheTabs() {
        // 80dp less the tab bar and the network bar leaves no row.
        val t = tabs(page = TRANSACTIONS_PAGE, width = 140f, height = 80f, isMainnet = false)
        assertEquals(0, transactionsLayout(140f, 80f - TAB_BAR_DP, true, topPaddingDp = TAB_PAGE_TOP_DP, bottomPaddingDp = TAB_PAGE_BOTTOM_DP).rowLimit)
        assertEquals(TabsMode.PortfolioOnly, t.mode)
        assertEquals(80f, t.pageHeightDp)
    }

    @Test fun theSmallestSizeStillHasARowUnderTheTabs() {
        assertEquals(TabsMode.Tabs, tabs(width = 110f, height = 110f).mode)
    }

    @Test fun aTapFetchesOnlyAPageNeverFetched() {
        assertTrue(tabNeedsFetch("key", isCached = false))
        assertFalse(tabNeedsFetch("key", isCached = true))
        assertFalse(tabNeedsFetch(null, isCached = false))
    }

    // A 2x2's pages match the standalone widgets: chart and fiat line on Portfolio, two rows at the ColorOS step
    // (140 × 130) and three from 160 × 150, with nothing past the page.
    private fun portfolioPage(width: Float, height: Float) = portfolioLayout(
        width, height - TAB_BAR_DP, portfolio.primary!!, hasNetworkBar = false, secondary = portfolio.secondary,
        hasChart = true, hasUpdated = true, topPaddingDp = TAB_PAGE_TOP_DP, bottomPaddingDp = TAB_PAGE_BOTTOM_DP,
    )

    private fun transactionsPage(width: Float, height: Float) = transactionsLayout(
        width, height - TAB_BAR_DP, hasNetworkBar = false, topPaddingDp = TAB_PAGE_TOP_DP, bottomPaddingDp = TAB_PAGE_BOTTOM_DP,
    )

    @Test fun aTwoByTwoPortfolioPageKeepsTheChartAndFiatLine() {
        for ((w, h) in listOf(140f to 130f, 160f to 150f)) {
            val l = portfolioPage(w, h)
            assertTrue("$w x $h chart", l.showChart)
            assertTrue("$w x $h fiat", l.showSecondary)
            assertTrue("$w x $h amount", l.amountSp >= TITLE_SP)
            assertTrue("$w x $h fits", l.usedDp <= h - TAB_BAR_DP + 0.01f)
        }
    }

    @Test fun aTwoByTwoTransactionsPageFitsTwoThenThreeRows() {
        assertEquals(2, transactionsPage(140f, 130f).rowLimit)
        assertEquals(3, transactionsPage(160f, 150f).rowLimit)
        for ((w, h) in listOf(140f to 130f, 160f to 150f)) assertTrue(transactionsPage(w, h).usedDp <= h - TAB_BAR_DP)
    }

    @Test fun theStandalonePagesAreUnchanged() {
        assertEquals(3, transactionsLayout(140f, 130f, hasNetworkBar = false).rowLimit)
        val l = portfolioLayout(140f, 130f, portfolio.primary!!, false, portfolio.secondary, hasChart = true, hasUpdated = true)
        assertEquals(PADDING_DP, l.topPaddingDp)
        assertEquals(PADDING_DP, l.bottomPaddingDp)
    }
}
