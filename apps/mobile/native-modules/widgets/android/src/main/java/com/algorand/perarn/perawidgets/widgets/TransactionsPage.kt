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

import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.ColorFilter
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.TextAlign
import com.algorand.perarn.perawidgets.R
import com.algorand.perarn.perawidgets.fetch.TransactionKind
import com.algorand.perarn.perawidgets.fetch.TransactionRow
import com.algorand.perarn.perawidgets.format.RowTime
import com.algorand.perarn.perawidgets.format.UpdatedTime
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import com.algorand.perarn.perawidgets.ui.PeraColors
import com.algorand.perarn.perawidgets.ui.PeraLogo
import com.algorand.perarn.perawidgets.ui.PeraText
import java.time.Instant
import java.time.ZoneId

// The size is what this page gets, so the tabs widget can hand it a column or the room above its tab bar.
@Composable
fun TransactionsPage(
    snapshot: WidgetSnapshot,
    content: TransactionsContent,
    colors: PeraColors,
    widthDp: Float,
    heightDp: Float,
    now: Instant,
    is24Hour: Boolean,
    isCompact: Boolean = widthDp < WIDE_FROM_DP,
    showLogo: Boolean = true,
    topPaddingDp: Float = TX_PADDING_DP,
    bottomPaddingDp: Float = TX_PADDING_DP,
) {
    val layout = transactionsLayout(widthDp, heightDp, snapshot.network?.isMainnet == false, isCompact, topPaddingDp, bottomPaddingDp)
    val locale = snapshotLocale(snapshot)
    val zone = ZoneId.systemDefault()
    Column(
        modifier = GlanceModifier.fillMaxSize().padding(
            start = TX_PADDING_DP.dp, end = TX_PADDING_DP.dp, top = layout.topPaddingDp.dp, bottom = layout.bottomPaddingDp.dp,
        ),
    ) {
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            PeraText(content.title, TITLE_SP.sp, FontWeight.Medium, colors.textGray, GlanceModifier.defaultWeight())
            if (showLogo) PeraLogo(LOGO_DP.dp) else Spacer(GlanceModifier.height(LOGO_DP.dp))
        }
        Spacer(GlanceModifier.height(TX_TITLE_GAP_DP.dp))
        val rows = content.rows.orEmpty().take(layout.rowLimit)
        // Only a fetched, empty history says so: before the first fetch, or with no room for a row, the page
        // stays blank rather than claiming there are none.
        if (content.rows?.isEmpty() == true && layout.rowLimit > 0) {
            Box(modifier = GlanceModifier.fillMaxWidth().defaultWeight(), contentAlignment = Alignment.Center) {
                PeraText(content.emptyText, 12.sp, FontWeight.Medium, colors.textGray, align = TextAlign.Center, maxLines = 2)
            }
        } else if (rows.isNotEmpty()) {
            val gap = if (layout.isCompact) TX_GAP_COMPACT_DP else TX_GAP_FULL_DP
            rows.forEachIndexed { index, row ->
                if (index > 0) Spacer(GlanceModifier.height(gap.dp))
                val time = RowTime.text(row.date, now, locale, zone, is24Hour, UpdatedTime.androidPatterns, RowTime.androidYesterday)
                TransactionRowView(row, transactionLabel(row.kind, snapshot), time, colors, layout.isCompact)
            }
        }
    }
}

@Composable
private fun TransactionRowView(row: TransactionRow, label: String, time: String, colors: PeraColors, isCompact: Boolean) {
    val amount = signedAmount(row)
    val amountColor = if (row.kind == TransactionKind.Receive) colors.positive else colors.textMain
    Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        TransactionIcon(row.kind, if (isCompact) 18f else 24f, colors)
        Spacer(GlanceModifier.width((if (isCompact) 6 else 8).dp))
        if (isCompact) {
            // Amount (or the label when nothing moved) over the time: a narrow column has no room for both side by side.
            Column {
                PeraText(amount ?: label, 11.sp, FontWeight.Medium, if (amount == null) colors.textMain else amountColor)
                PeraText(time, 9.sp, FontWeight.Normal, colors.textGray)
            }
        } else {
            Column(modifier = GlanceModifier.defaultWeight()) {
                PeraText(label, 12.sp, FontWeight.Medium, colors.textMain)
                PeraText(time, 10.sp, FontWeight.Normal, colors.textGray)
            }
            amount?.let {
                Spacer(GlanceModifier.width(4.dp))
                PeraText(it, 12.sp, FontWeight.Medium, amountColor)
            }
        }
    }
}

@Composable
private fun TransactionIcon(kind: TransactionKind, sizeDp: Float, colors: PeraColors) {
    Box(
        modifier = GlanceModifier.size(sizeDp.dp).background(colors.layer).cornerRadius((sizeDp / 2).dp),
        contentAlignment = Alignment.Center,
    ) {
        Image(
            provider = ImageProvider(iconFor(kind)),
            contentDescription = null,
            modifier = GlanceModifier.size((sizeDp * 0.55f).dp),
            colorFilter = ColorFilter.tint(colors.textMain),
        )
    }
}

private fun iconFor(kind: TransactionKind): Int = when (kind) {
    TransactionKind.Send -> R.drawable.ic_widget_tx_send
    TransactionKind.Receive -> R.drawable.ic_widget_tx_receive
    TransactionKind.Swap -> R.drawable.ic_widget_tx_swap
    TransactionKind.OptIn -> R.drawable.ic_widget_tx_opt_in
    TransactionKind.OptOut -> R.drawable.ic_widget_tx_opt_out
    TransactionKind.AppCall -> R.drawable.ic_widget_tx_app_call
    TransactionKind.Other -> R.drawable.ic_widget_tx_other
}
