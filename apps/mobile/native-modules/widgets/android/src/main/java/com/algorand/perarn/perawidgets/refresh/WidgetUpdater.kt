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
package com.algorand.perarn.perawidgets.refresh

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState
import com.algorand.perarn.perawidgets.config.WidgetConfig
import com.algorand.perarn.perawidgets.fetch.QuoteCache
import com.algorand.perarn.perawidgets.snapshot.SnapshotStore
import com.algorand.perarn.perawidgets.widgets.PortfolioWidget
import com.algorand.perarn.perawidgets.widgets.PriceWidget
import com.algorand.perarn.perawidgets.widgets.WidgetKinds
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

// Skips the redraw when the app rewrote an identical snapshot, which it does on every foreground.
fun shouldRedraw(previous: String?, next: String): Boolean = previous != next

object WidgetVersion {
    val key = intPreferencesKey("version")

    fun next(current: Int?): Int = (current ?: 0) + 1
}

// A live Glance session only recomposes on update(); it never re-runs provideGlance. Bumping the per-widget
// state makes the composition reload the snapshot, config and cached quote it reads.
object WidgetUpdater {
    // Outlives the bridge call or activity that starts a redraw, so the redraw finishes after it returns.
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    // One fetch-and-store pass at a time, so a slower, older fetch can't overwrite a newer quote.
    private val fetchLock = Mutex()

    // Redraws first show the stored data, so privacy turning on is never delayed by a fetch.
    suspend fun updateAll(context: Context) {
        val manager = GlanceAppWidgetManager(context)
        val placed = WidgetKinds.all.map { kind -> kind to safely { manager.getGlanceIds(kind) }.orEmpty() }
        for ((kind, ids) in placed) for (id in ids) safely { redraw(context, kind, id) }
        for ((kind, ids) in placed) refresh(context, kind, ids.map { manager.getAppWidgetId(it) })
    }

    // Saved settings reach a live session only through a version bump; the configure broadcast alone keeps the old options.
    fun redraw(context: Context, appWidgetId: Int) {
        val appContext = context.applicationContext
        scope.launch {
            val provider = AppWidgetManager.getInstance(appContext).getAppWidgetInfo(appWidgetId)?.provider ?: return@launch
            val kind = WidgetKinds.forReceiver(provider.className) ?: return@launch
            safely { redraw(appContext, kind, GlanceAppWidgetManager(appContext).getGlanceIdBy(appWidgetId)) }
        }
    }

    // Runs under the fetch lock, so a fetch already in flight can't store a quote after the wipe.
    suspend fun forgetWalletData(context: Context) {
        fetchLock.withLock { clearWalletData(context) }
    }

    fun clearWalletData(context: Context) {
        QuoteCache.clearAll(context)
        WidgetConfig.clearAll(context)
    }

    // Fetch, then redraw only when a quote was stored. Sessions render before this runs, so a slow network never delays a redraw.
    suspend fun refresh(context: Context, kind: Class<out GlanceAppWidget>, appWidgetIds: List<Int>) = fetchLock.withLock {
        val manager = GlanceAppWidgetManager(context)
        val snapshot = SnapshotStore(context).load()
        for (widgetId in appWidgetIds) {
            safely {
                val stored = when (kind) {
                    PortfolioWidget::class.java ->
                        refreshPortfolioQuote(context, widgetId, snapshot, WidgetConfig(context).portfolio(widgetId))
                    PriceWidget::class.java ->
                        refreshPriceQuote(context, widgetId, snapshot, WidgetConfig(context).price(widgetId))
                    else -> false
                }
                if (stored) redraw(context, kind, manager.getGlanceIdBy(widgetId))
            }
        }
    }

    private suspend fun redraw(context: Context, kind: Class<out GlanceAppWidget>, id: GlanceId) {
        updateAppWidgetState(context, id) { prefs: MutablePreferences ->
            prefs[WidgetVersion.key] = WidgetVersion.next(prefs[WidgetVersion.key])
        }
        kind.getDeclaredConstructor().newInstance().update(context, id)
    }

    // A failure in one widget must not leave the others stale.
    private suspend fun <T> safely(block: suspend () -> T): T? =
        try {
            block()
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            null
        }
}
