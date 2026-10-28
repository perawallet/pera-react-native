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

import com.algorand.perarn.perawidgets.ui.fittedTextSize

const val WIDE_FROM_DP = 250f
const val PADDING_DP = 14f
const val SHORT_PADDING_DP = 8f
const val SHORT_BELOW_DP = 100f
const val LOGO_DP = 18f
const val NETWORK_BAR_DP = 20f
const val TITLE_SP = 12f
const val MIN_CHART_DP = 16f
const val CHART_MARGIN_DP = 6f
const val UPDATED_DP = 14f
const val AMOUNT_LINE = 1.3f
const val SECONDARY_LINE = 1.4f
const val SIDE_GAP_DP = 8f
const val GLYPH_EM = 0.58f
const val MIN_AMOUNT_SP = 9f
const val MIN_PADDING_DP = 2f

data class PortfolioLayout(
    val isWide: Boolean,
    val amountSp: Float,
    val secondarySp: Float,
    val verticalPaddingDp: Float,
    val showChart: Boolean,
    val showSecondary: Boolean,
    val chartWidthDp: Float,
    val chartHeightDp: Float,
    // Height of every row, chart included, for checking against the widget.
    val usedDp: Float,
)

// Fits the rows to the real height: the amount shrinks first, then the chart goes, then the
// "≈ fiat" line. Title, amount and "Updated" always stay.
fun portfolioLayout(
    widthDp: Float,
    heightDp: Float,
    primary: String,
    hasNetworkBar: Boolean,
    secondary: String?,
    hasChart: Boolean,
    hasUpdated: Boolean,
): PortfolioLayout {
    val isWide = widthDp >= WIDE_FROM_DP
    val contentWidth = widthDp - 2 * PADDING_DP
    var verticalPadding = if (heightDp < SHORT_BELOW_DP) SHORT_PADDING_DP else PADDING_DP
    val secondarySp = if (isWide) 14f else 12f
    var widthFit = fittedTextSize(primary, contentWidth, if (isWide) 28f else 22f, TITLE_SP)
    var sideBySideFits = true
    if (isWide && secondary != null) {
        // Wide puts the "≈ fiat" beside the amount: it costs width, not height.
        val beside = contentWidth - SIDE_GAP_DP - secondary.length * GLYPH_EM * secondarySp
        val amountFit = beside / (primary.length * GLYPH_EM)
        if (amountFit >= TITLE_SP) widthFit = minOf(widthFit, amountFit) else sideBySideFits = false
    }
    fun fixed() = 2 * verticalPadding + (if (hasNetworkBar) NETWORK_BAR_DP else 0f) + LOGO_DP + 2f +
        (if (hasUpdated) UPDATED_DP else 0f)
    val secondaryHeight = if (isWide) 0f else secondarySp * SECONDARY_LINE
    val chartBlock = MIN_CHART_DP + CHART_MARGIN_DP

    fun amountFor(showChart: Boolean, showSecondary: Boolean): Float {
        val room = heightDp - fixed() - (if (showSecondary) secondaryHeight else 0f) - (if (showChart) chartBlock else 0f)
        return minOf(widthFit, room / AMOUNT_LINE)
    }

    var showChart = hasChart
    var showSecondary = secondary != null && sideBySideFits
    if (amountFor(showChart, showSecondary) < TITLE_SP && showChart) showChart = false
    if (amountFor(showChart, showSecondary) < TITLE_SP && showSecondary) showSecondary = false
    // Last resorts for very short widgets: a smaller amount, then tighter padding.
    if (amountFor(showChart, showSecondary) < MIN_AMOUNT_SP) verticalPadding = MIN_PADDING_DP
    val amountSp = amountFor(showChart, showSecondary).coerceAtLeast(MIN_AMOUNT_SP)

    val rows = fixed() + amountSp * AMOUNT_LINE + (if (showSecondary) secondaryHeight else 0f)
    val chartHeight = if (showChart) (heightDp - rows - CHART_MARGIN_DP).coerceAtLeast(MIN_CHART_DP) else 0f
    val used = rows + (if (showChart) chartHeight + CHART_MARGIN_DP else 0f)
    return PortfolioLayout(
        isWide, amountSp, secondarySp, verticalPadding, showChart, showSecondary,
        contentWidth, chartHeight, used,
    )
}
