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

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.text.format.DateFormat
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.dp
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.glance.ColorFilter
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.state.PreferencesGlanceStateDefinition
import com.algorand.perarn.perawidgets.R
import com.algorand.perarn.perawidgets.config.WidgetConfig
import com.algorand.perarn.perawidgets.fetch.PortfolioQuote
import com.algorand.perarn.perawidgets.fetch.QuoteCache
import com.algorand.perarn.perawidgets.fetch.TransactionsQuote
import com.algorand.perarn.perawidgets.format.UpdatedTime
import com.algorand.perarn.perawidgets.refresh.WidgetRefreshScheduler
import com.algorand.perarn.perawidgets.refresh.WidgetVersion
import com.algorand.perarn.perawidgets.snapshot.SnapshotStore
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import com.algorand.perarn.perawidgets.snapshot.string
import com.algorand.perarn.perawidgets.ui.PeraChrome
import com.algorand.perarn.perawidgets.ui.PeraColors
import com.algorand.perarn.perawidgets.ui.PeraPlaceholder
import com.algorand.perarn.perawidgets.ui.PeraSizeMode
import com.algorand.perarn.perawidgets.ui.PeraTheme
import java.time.Instant
import java.time.ZoneId

// Per widget, unlike iOS where every copy of a kind shares one page.
internal val PageKey = intPreferencesKey("page")
internal val PageParam = ActionParameters.Key<Int>("page")

class PortfolioTabsWidget : GlanceAppWidget() {
    override val sizeMode: SizeMode = PeraSizeMode
    override val stateDefinition = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val appWidgetId = GlanceAppWidgetManager(context).getAppWidgetId(id)

        provideContent {
            val state = currentState<Preferences>()
            val version = state[WidgetVersion.key]
            val page = state[PageKey] ?: PORTFOLIO_PAGE
            val snapshot = remember(version) { SnapshotStore(context).load() }
            val is24Hour = remember(version) { DateFormat.is24HourFormat(context) }
            val options = remember(version) { WidgetConfig(context).portfolio(appWidgetId) }
            val portfolio = remember(version) {
                snapshot?.let { s ->
                    val cached = portfolioQuoteKey(s, options)?.let { QuoteCache(context).get<PortfolioQuote>(appWidgetId, it) }
                    portfolioContent(s, options, cached, Instant.now(), snapshotLocale(s), ZoneId.systemDefault(), is24Hour, UpdatedTime.androidPatterns)
                }
            }
            val transactions = remember(version) {
                snapshot?.let { s ->
                    val cached = transactionsQuoteKey(s, options.accountAddress)
                        ?.let { QuoteCache(context).get<TransactionsQuote>(appWidgetId, it) }
                    transactionsContent(s, options.accountAddress, cached)
                }
            }
            val now = remember(version) { Instant.now() }
            val colors = PeraTheme.colors(snapshot?.theme)
            if (snapshot == null || portfolio == null) {
                PeraPlaceholder(colors)
            } else {
                val isDark = PeraTheme.isDark(snapshot.theme, PeraTheme.systemIsDark(context))
                TabsView(context, snapshot, portfolio, transactions, page, colors, isDark, now, is24Hour)
            }
        }
    }
}

@Composable
private fun TabsView(
    context: Context,
    snapshot: WidgetSnapshot,
    portfolio: PortfolioContent,
    transactions: TransactionsContent?,
    page: Int,
    colors: PeraColors,
    isDark: Boolean,
    now: Instant,
    is24Hour: Boolean,
) {
    val size = LocalSize.current
    val width = size.width.value
    val height = size.height.value
    val tabs = tabsContent(snapshot, portfolio, transactions, page, width, height)
    val tx = tabs.transactions
    val open = Intent(Intent.ACTION_VIEW, Uri.parse(tabs.tapUrl)).setPackage(context.packageName)

    PeraChrome(colors, snapshot.network, GlanceModifier.clickable(actionStartActivity(open))) {
        if (tabs.mode == TabsMode.PortfolioOnly || tx == null) {
            PortfolioPage(context, snapshot, portfolio, colors, isDark, width, height)
        } else if (tabs.mode == TabsMode.SideBySide) {
            val column = (width - 1f) / 2
            Row(modifier = GlanceModifier.fillMaxSize()) {
                Box(modifier = GlanceModifier.defaultWeight().fillMaxHeight()) {
                    PortfolioPage(context, snapshot, portfolio, colors, isDark, column, height, showLogo = false)
                }
                Box(modifier = GlanceModifier.width(1.dp).fillMaxHeight().padding(vertical = PADDING_DP.dp)) {
                    Box(modifier = GlanceModifier.fillMaxSize().background(colors.layer)) {}
                }
                Box(modifier = GlanceModifier.defaultWeight().fillMaxHeight()) {
                    val title = snapshot.string("recentTransactions") ?: tx.title
                    TransactionsPage(snapshot, tx.copy(title = title), colors, column, height, now, is24Hour, isCompact = true)
                }
            }
        } else {
            Column(modifier = GlanceModifier.fillMaxSize()) {
                Box(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
                    if (tabs.showsTransactions) {
                        TransactionsPage(
                            snapshot, tx, colors, width, tabs.pageHeightDp, now, is24Hour,
                            topPaddingDp = TAB_PAGE_TOP_DP, bottomPaddingDp = TAB_PAGE_BOTTOM_DP,
                        )
                    } else {
                        PortfolioPage(
                            context, snapshot, portfolio, colors, isDark, width, tabs.pageHeightDp,
                            topPaddingDp = TAB_PAGE_TOP_DP, bottomPaddingDp = TAB_PAGE_BOTTOM_DP,
                        )
                    }
                }
                Row(modifier = GlanceModifier.fillMaxWidth().padding(start = 10.dp, end = 10.dp, bottom = TAB_BAR_BOTTOM_DP.dp)) {
                    Tab(PORTFOLIO_PAGE, R.drawable.ic_widget_tab_chart, snapshot.string("tabPortfolio"), page, colors, GlanceModifier.defaultWeight())
                    Spacer(GlanceModifier.width(6.dp))
                    Tab(TRANSACTIONS_PAGE, R.drawable.ic_widget_tab_list, snapshot.string("tabTransactions"), page, colors, GlanceModifier.defaultWeight())
                }
            }
        }
    }
}

// Each tab shows its page rather than toggling, so a tap always lands where the icon says.
@Composable
private fun Tab(index: Int, icon: Int, label: String?, page: Int, colors: PeraColors, modifier: GlanceModifier) {
    val isSelected = index == page
    Box(
        modifier = modifier
            .height(TAB_HEIGHT_DP.dp)
            .background(if (isSelected) colors.textMain else colors.layer)
            .cornerRadius(8.dp)
            .clickable(actionRunCallback<SelectPageAction>(actionParametersOf(PageParam to index))),
        contentAlignment = Alignment.Center,
    ) {
        Image(
            provider = ImageProvider(icon),
            contentDescription = label,
            modifier = GlanceModifier.size(15.dp),
            colorFilter = ColorFilter.tint(if (isSelected) colors.background else colors.textGray),
        )
    }
}

class SelectPageAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val page = parameters[PageParam] ?: return
        // The page is read outside remember(version), so changing it is enough to redraw.
        updateAppWidgetState(context, glanceId) { prefs: MutablePreferences -> prefs[PageKey] = page }
        PortfolioTabsWidget().update(context, glanceId)

        val snapshot = SnapshotStore(context).load() ?: return
        val appWidgetId = GlanceAppWidgetManager(context).getAppWidgetId(glanceId)
        val options = WidgetConfig(context).portfolio(appWidgetId)
        val cache = QuoteCache(context)
        val needsFetch = if (page == TRANSACTIONS_PAGE) {
            val key = transactionsQuoteKey(snapshot, options.accountAddress)
            tabNeedsFetch(key, key != null && cache.get<TransactionsQuote>(appWidgetId, key) != null)
        } else {
            val key = portfolioQuoteKey(snapshot, options)
            tabNeedsFetch(key, key != null && cache.get<PortfolioQuote>(appWidgetId, key) != null)
        }
        if (needsFetch) WidgetRefreshScheduler.refreshSoon(context)
    }
}
