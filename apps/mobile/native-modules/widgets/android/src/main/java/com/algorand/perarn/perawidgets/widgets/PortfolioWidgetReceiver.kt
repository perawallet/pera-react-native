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

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import com.algorand.perarn.perawidgets.refresh.WidgetRefreshScheduler

class PortfolioWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = PortfolioWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        WidgetRefreshScheduler.schedule(context)
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        WidgetRefreshScheduler.schedule(context)
        WidgetRefreshScheduler.refreshSoon(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        super.onDeleted(context, appWidgetIds)
        WidgetRefreshScheduler.forget(context, appWidgetIds)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        WidgetRefreshScheduler.cancelIfNoWidgetsLeft(context)
    }
}

object WidgetKinds {
    val all: List<Class<out GlanceAppWidget>> = listOf(PortfolioWidget::class.java, PriceWidget::class.java, ReceiveWidget::class.java)

    fun forReceiver(className: String): Class<out GlanceAppWidget>? =
        when (className) {
            PortfolioWidgetReceiver::class.java.name -> PortfolioWidget::class.java
            PriceWidgetReceiver::class.java.name -> PriceWidget::class.java
            ReceiveWidgetReceiver::class.java.name -> ReceiveWidget::class.java
            else -> null
        }
}
