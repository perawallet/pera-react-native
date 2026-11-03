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
import android.content.ComponentName
import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.algorand.perarn.perawidgets.config.WidgetConfig
import com.algorand.perarn.perawidgets.fetch.QuoteCache
import com.algorand.perarn.perawidgets.widgets.WidgetKinds
import java.util.concurrent.TimeUnit

const val REFRESH_WORK_NAME = "pera-widgets-refresh"
const val REFRESH_NOW_WORK_NAME = "pera-widgets-refresh-now"
const val REFRESH_RETRY_WORK_NAME = "pera-widgets-refresh-retry"
private const val REFRESH_MINUTES = 30L
private const val RETRY_MINUTES = 5L

// onDisabled fires per widget kind, so work is only cancelled once no kind has a widget placed.
fun noWidgetsLeft(vararg idsPerKind: IntArray): Boolean = idsPerKind.all { it.isEmpty() }

class WidgetRefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        WidgetUpdater.updateAll(applicationContext)
        return Result.success()
    }
}

object WidgetRefreshScheduler {
    fun schedule(context: Context) {
        // No network constraint: offline the fetch fails fast and keeps the last quote, but the redraw still
        // runs, so an "Updated" time from yesterday gains its day instead of reading as today.
        val request = PeriodicWorkRequestBuilder<WidgetRefreshWorker>(REFRESH_MINUTES, TimeUnit.MINUTES).build()
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(REFRESH_WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
    }

    // Network never runs inside a receiver; onUpdate hands the fetch to this job instead. KEEP: a pass already
    // queued or running covers every widget, and replacing it would cancel its fetches halfway.
    fun refreshSoon(context: Context) {
        val request = OneTimeWorkRequestBuilder<WidgetRefreshWorker>().build()
        WorkManager.getInstance(context).enqueueUniqueWork(REFRESH_NOW_WORK_NAME, ExistingWorkPolicy.KEEP, request)
    }

    // After a failed fetch, sooner than the next 30-minute run. A failure during the retry itself finds it still
    // running and adds nothing, so a network that stays down costs one extra pass, not a loop.
    fun retryLater(context: Context) {
        val request = OneTimeWorkRequestBuilder<WidgetRefreshWorker>().setInitialDelay(RETRY_MINUTES, TimeUnit.MINUTES).build()
        WorkManager.getInstance(context).enqueueUniqueWork(REFRESH_RETRY_WORK_NAME, ExistingWorkPolicy.KEEP, request)
    }

    fun cancelIfNoWidgetsLeft(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val ids = WidgetKinds.receivers.map { manager.getAppWidgetIds(ComponentName(context, it)) }
        if (noWidgetsLeft(*ids.toTypedArray())) {
            val work = WorkManager.getInstance(context)
            listOf(REFRESH_WORK_NAME, REFRESH_NOW_WORK_NAME, REFRESH_RETRY_WORK_NAME).forEach { work.cancelUniqueWork(it) }
        }
    }

    // Glance deletes the widget's own state (version, page) in its onDeleted; this drops what Pera stores beside it.
    fun forget(context: Context, widgetIds: IntArray) {
        val config = WidgetConfig(context)
        val quotes = QuoteCache(context)
        for (id in widgetIds) {
            config.delete(id)
            quotes.clear(id)
        }
    }
}
