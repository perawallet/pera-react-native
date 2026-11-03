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

// 24dp tabs, about half the widget wide, stay an easy tap while leaving a 2x2's pages the room for the chart and
// the "≈ fiat" line, and for two rows (three from the 160 × 150 step).
const val TAB_HEIGHT_DP = 24f
const val TAB_BAR_BOTTOM_DP = 5f
const val TAB_BAR_DP = TAB_HEIGHT_DP + TAB_BAR_BOTTOM_DP
// The tab bar takes the place of a page's bottom padding, as on iOS, rather than adding to it.
const val TAB_PAGE_TOP_DP = 8f
const val TAB_PAGE_BOTTOM_DP = 4f
const val PORTFOLIO_PAGE = 0
const val TRANSACTIONS_PAGE = 1

enum class TabsMode { PortfolioOnly, SideBySide, Tabs }

data class TabsContent(
    val mode: TabsMode,
    // Only in Tabs mode.
    val showsTransactions: Boolean,
    val tapUrl: String,
    // Null in PortfolioOnly mode, and always in privacy mode.
    val transactions: TransactionsContent?,
    // What each page gets: the whole widget, or the room above the tab bar.
    val pageHeightDp: Float,
)

fun tabsContent(
    snapshot: WidgetSnapshot,
    portfolio: PortfolioContent,
    transactions: TransactionsContent?,
    page: Int,
    widthDp: Float,
    heightDp: Float,
): TabsContent {
    // Privacy mode has nothing to list, so there is no second page.
    val tx = transactions?.takeIf { snapshot.portfolio?.state != "hidden" }
        ?: return TabsContent(TabsMode.PortfolioOnly, false, portfolio.tapUrl, null, heightDp)
    // A wide widget has room for both, as iOS's medium size.
    if (widthDp >= WIDE_FROM_DP) return TabsContent(TabsMode.SideBySide, false, portfolio.tapUrl, tx, heightDp)
    val pageHeight = heightDp - TAB_BAR_DP
    val rows = transactionsLayout(
        widthDp, pageHeight, snapshot.network?.isMainnet == false,
        topPaddingDp = TAB_PAGE_TOP_DP, bottomPaddingDp = TAB_PAGE_BOTTOM_DP,
    ).rowLimit
    // A page with no room for one row would be a blank list behind its tab, so the widget is the portfolio alone.
    if (rows == 0) return TabsContent(TabsMode.PortfolioOnly, false, portfolio.tapUrl, null, heightDp)
    val showsTransactions = page == TRANSACTIONS_PAGE
    return TabsContent(TabsMode.Tabs, showsTransactions, if (showsTransactions) tx.tapUrl else portfolio.tapUrl, tx, pageHeight)
}

// A tap only redraws, unless the page it shows has never been fetched (no key means nothing could be fetched).
fun tabNeedsFetch(pageKey: String?, isCached: Boolean): Boolean = pageKey != null && !isCached
