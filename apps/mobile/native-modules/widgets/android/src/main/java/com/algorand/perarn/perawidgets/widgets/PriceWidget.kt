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
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.glance.ColorFilter
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import com.algorand.perarn.perawidgets.R
import com.algorand.perarn.perawidgets.config.WidgetConfig
import com.algorand.perarn.perawidgets.fetch.PriceQuote
import com.algorand.perarn.perawidgets.fetch.QuoteCache
import com.algorand.perarn.perawidgets.format.UpdatedTime
import com.algorand.perarn.perawidgets.refresh.WidgetVersion
import com.algorand.perarn.perawidgets.snapshot.SnapshotStore
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import com.algorand.perarn.perawidgets.ui.PeraChrome
import com.algorand.perarn.perawidgets.ui.PeraColors
import com.algorand.perarn.perawidgets.ui.PeraLogo
import com.algorand.perarn.perawidgets.ui.PeraPlaceholder
import com.algorand.perarn.perawidgets.ui.PeraSizeMode
import com.algorand.perarn.perawidgets.ui.PeraText
import com.algorand.perarn.perawidgets.ui.PeraTheme
import com.algorand.perarn.perawidgets.ui.SparklineImage
import java.time.Instant
import java.time.ZoneId

class PriceWidget : GlanceAppWidget() {
    override val sizeMode: SizeMode = PeraSizeMode
    override val stateDefinition = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val appWidgetId = GlanceAppWidgetManager(context).getAppWidgetId(id)

        provideContent {
            // A live session recomposes without re-running provideGlance, so everything is read per version.
            val version = currentState<Preferences>()[WidgetVersion.key]
            val snapshot = remember(version) { SnapshotStore(context).load() }
            val is24Hour = remember(version) { DateFormat.is24HourFormat(context) }
            val options = remember(version) { WidgetConfig(context).price(appWidgetId) }
            val content = remember(version) {
                snapshot?.let { s ->
                    val cached = priceQuoteKey(s, options)?.let { QuoteCache(context).get<PriceQuote>(appWidgetId, it) }
                    priceContent(s, options, cached, Instant.now(), snapshotLocale(s), ZoneId.systemDefault(), is24Hour, UpdatedTime.androidPatterns)
                }
            }
            val colors = PeraTheme.colors(snapshot?.theme)
            if (snapshot == null || content == null) {
                PeraPlaceholder(colors)
            } else {
                PriceView(context, snapshot, content, colors, PeraTheme.isDark(snapshot.theme, PeraTheme.systemIsDark(context)))
            }
        }
    }
}

@Composable
private fun PriceView(
    context: Context,
    snapshot: WidgetSnapshot,
    content: PriceContent,
    colors: PeraColors,
    isDark: Boolean,
) {
    val size = LocalSize.current
    val price = content.price ?: "—"
    val layout = priceLayout(
        size.width.value, size.height.value, price,
        hasNetworkBar = snapshot.network?.isMainnet == false,
        hasAssetId = content.assetIdLine != null,
        hasChange = content.change != null,
        hasInverse = content.inverse != null,
        hasChart = content.chart != null,
        hasUpdated = content.updatedText != null,
    )
    val open = Intent(Intent.ACTION_VIEW, Uri.parse(content.tapUrl)).setPackage(context.packageName)
    val trend = if (content.isTrendUp) colors.positive else colors.negative

    PeraChrome(colors, snapshot.network, GlanceModifier.clickable(actionStartActivity(open))) {
        Column(modifier = GlanceModifier.fillMaxSize().padding(horizontal = PADDING_DP.dp, vertical = layout.verticalPaddingDp.dp)) {
            Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                PeraText(content.title, TITLE_SP.sp, FontWeight.Medium, colors.textGray)
                Spacer(GlanceModifier.width(3.dp))
                Image(
                    provider = ImageProvider(R.drawable.ic_widget_verified),
                    contentDescription = null,
                    modifier = GlanceModifier.size(11.dp),
                    colorFilter = ColorFilter.tint(colors.positive),
                )
                if (layout.isIdInline) content.assetIdLine?.let {
                    PeraText(" · $it", 9.sp, FontWeight.Normal, colors.textGray)
                }
                Spacer(GlanceModifier.defaultWeight())
                PeraLogo(LOGO_DP.dp)
            }
            content.assetIdLine?.takeIf { !layout.isIdInline }?.let { PeraText(it, 9.sp, FontWeight.Normal, colors.textGray) }
            // Figures sit at the bottom, as on iOS, so a tall widget's spare room goes above them.
            Spacer(GlanceModifier.defaultWeight())
            Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                Column(modifier = GlanceModifier.width(layout.figuresWidthDp.dp)) {
                    PeraText(price, layout.priceSp.sp, FontWeight.Bold, colors.textMain)
                    content.change?.takeIf { layout.showChange }?.let {
                        Spacer(GlanceModifier.height(LINE_GAP_DP.dp))
                        PeraText(it, PRICE_CHANGE_SP.sp, FontWeight.Medium, trend)
                    }
                    val chart = content.chart
                    if (chart != null && layout.showChart && !layout.isWide) {
                        Spacer(GlanceModifier.height((CHART_MARGIN_DP / 2).dp))
                        SparklineImage(context, chart, layout.chartWidthDp, layout.chartHeightDp, content.isTrendUp, isDark)
                        Spacer(GlanceModifier.height((CHART_MARGIN_DP / 2).dp))
                    }
                    content.inverse?.takeIf { layout.showInverse }?.let {
                        Spacer(GlanceModifier.height(LINE_GAP_DP.dp))
                        PeraText(it, PRICE_INVERSE_SP.sp, FontWeight.Normal, colors.textGray)
                    }
                    content.updatedText?.let {
                        Spacer(GlanceModifier.height(LINE_GAP_DP.dp))
                        PeraText(it, 10.sp, FontWeight.Normal, colors.textGray)
                    }
                }
                val chart = content.chart
                if (chart != null && layout.showChart && layout.isWide) {
                    Spacer(GlanceModifier.width(SIDE_GAP_DP.dp))
                    SparklineImage(context, chart, layout.chartWidthDp, layout.chartHeightDp, content.isTrendUp, isDark)
                }
            }
        }
    }
}

