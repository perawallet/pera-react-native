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
import androidx.compose.runtime.remember
import androidx.datastore.preferences.core.Preferences
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.state.PreferencesGlanceStateDefinition
import com.algorand.perarn.perawidgets.config.WidgetConfig
import com.algorand.perarn.perawidgets.fetch.QuoteCache
import com.algorand.perarn.perawidgets.fetch.TransactionsQuote
import com.algorand.perarn.perawidgets.refresh.WidgetVersion
import com.algorand.perarn.perawidgets.snapshot.SnapshotStore
import com.algorand.perarn.perawidgets.ui.PeraChrome
import com.algorand.perarn.perawidgets.ui.PeraPlaceholder
import com.algorand.perarn.perawidgets.ui.PeraSizeMode
import com.algorand.perarn.perawidgets.ui.PeraTheme
import java.time.Instant

class TransactionsWidget : GlanceAppWidget() {
    override val sizeMode: SizeMode = PeraSizeMode
    override val stateDefinition = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val appWidgetId = GlanceAppWidgetManager(context).getAppWidgetId(id)

        provideContent {
            // A live session recomposes without re-running provideGlance, so everything is read per version.
            val version = currentState<Preferences>()[WidgetVersion.key]
            val snapshot = remember(version) { SnapshotStore(context).load() }
            val options = remember(version) { WidgetConfig(context).transactions(appWidgetId) }
            val content = remember(version) {
                snapshot?.let { s ->
                    val cached = transactionsQuoteKey(s, options.accountAddress)
                        ?.let { QuoteCache(context).get<TransactionsQuote>(appWidgetId, it) }
                    transactionsContent(s, options.accountAddress, cached)
                }
            }
            val now = remember(version) { Instant.now() }
            val is24Hour = remember(version) { DateFormat.is24HourFormat(context) }
            val colors = PeraTheme.colors(snapshot?.theme)
            if (snapshot == null || content == null) {
                PeraPlaceholder(colors)
            } else {
                val size = LocalSize.current
                val open = Intent(Intent.ACTION_VIEW, Uri.parse(content.tapUrl)).setPackage(context.packageName)
                PeraChrome(colors, snapshot.network, GlanceModifier.clickable(actionStartActivity(open))) {
                    TransactionsPage(snapshot, content, colors, size.width.value, size.height.value, now, is24Hour)
                }
            }
        }
    }
}
