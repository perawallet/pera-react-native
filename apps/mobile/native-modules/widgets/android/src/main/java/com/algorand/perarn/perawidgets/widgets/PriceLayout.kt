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

const val PRICE_CHANGE_SP = 13f
const val PRICE_INVERSE_SP = 11f
const val PRICE_ASSET_ID_DP = 12f
const val PRICE_CHART_SHARE = 0.4f
const val PRICE_MIN_SP = 9f
const val PRICE_MIN_PADDING_DP = 2f

data class PriceLayout(
    val isWide: Boolean,
    val priceSp: Float,
    val verticalPaddingDp: Float,
    // The asset id moves onto the title row when there is no height for its own line; it is never dropped.
    val isIdInline: Boolean,
    val showChange: Boolean,
    val showInverse: Boolean,
    val showChart: Boolean,
    val figuresWidthDp: Float,
    val chartWidthDp: Float,
    val chartHeightDp: Float,
    // Height of the stacked rows, for checking against the widget.
    val usedDp: Float,
)

// Fits the rows to the real height. In order: the price shrinks to the title size, the
// per-currency line goes, then the change, then the id moves beside the title; only then does the
// price go below the title size (to 9sp), and last the padding shrinks. Title, price, id and
// "Updated" always stay; the chart only exists on wide widgets.
fun priceLayout(
    widthDp: Float,
    heightDp: Float,
    price: String,
    hasNetworkBar: Boolean,
    hasAssetId: Boolean,
    hasChange: Boolean,
    hasInverse: Boolean,
    hasChart: Boolean,
    hasUpdated: Boolean,
): PriceLayout {
    val isWide = widthDp >= WIDE_FROM_DP
    val contentWidth = widthDp - 2 * PADDING_DP
    val defaultPadding = if (heightDp < SHORT_BELOW_DP) SHORT_PADDING_DP else PADDING_DP
    val changeHeight = PRICE_CHANGE_SP * AMOUNT_LINE
    val inverseHeight = PRICE_INVERSE_SP * SECONDARY_LINE

    fun chromeFor(padding: Float, idInline: Boolean) =
        2 * padding + (if (hasNetworkBar) NETWORK_BAR_DP else 0f) + LOGO_DP +
            (if (hasAssetId && !idInline) PRICE_ASSET_ID_DP else 0f) + 2f + (if (hasUpdated) UPDATED_DP else 0f)

    fun chartHeightFor(chrome: Float) = heightDp - chrome - CHART_MARGIN_DP
    val showChart = isWide && hasChart && chartHeightFor(chromeFor(defaultPadding, false)) >= MIN_CHART_DP
    val chartWidth = if (showChart) contentWidth * PRICE_CHART_SHARE else 0f
    val figuresWidth = if (showChart) contentWidth - chartWidth - SIDE_GAP_DP else contentWidth
    val widthFit = fittedTextSize(price, figuresWidth, if (isWide) 28f else 22f, PRICE_MIN_SP)

    fun build(padding: Float, idInline: Boolean, showChange: Boolean, showInverse: Boolean, floor: Float): PriceLayout? {
        val chrome = chromeFor(padding, idInline)
        val room = heightDp - chrome - (if (showChange) changeHeight else 0f) - (if (showInverse) inverseHeight else 0f)
        val fit = minOf(widthFit, room / AMOUNT_LINE)
        if (fit < floor) return null
        val used = chrome + fit * AMOUNT_LINE + (if (showChange) changeHeight else 0f) +
            (if (showInverse) inverseHeight else 0f)
        val chartHeight = if (showChart) chartHeightFor(chrome).coerceAtLeast(MIN_CHART_DP) else 0f
        return PriceLayout(isWide, fit, padding, idInline, showChange, showInverse, showChart, figuresWidth, chartWidth, chartHeight, used)
    }

    val steps = listOf(
        Triple(false, hasChange, hasInverse),
        Triple(false, hasChange, false),
        Triple(false, false, false),
        Triple(true, false, false),
    )
    for ((idInline, change, inverse) in steps) {
        build(defaultPadding, idInline && hasAssetId, change, inverse, TITLE_SP)?.let { return it }
    }
    for (padding in listOf(defaultPadding, PRICE_MIN_PADDING_DP)) {
        build(padding, true, false, false, PRICE_MIN_SP)?.let { return it }
    }
    // Nothing fits: draw the smallest layout rather than none.
    return PriceLayout(
        isWide, PRICE_MIN_SP, PRICE_MIN_PADDING_DP, true, false, false, showChart, figuresWidth, chartWidth,
        if (showChart) chartHeightFor(chromeFor(PRICE_MIN_PADDING_DP, true)).coerceAtLeast(MIN_CHART_DP) else 0f,
        chromeFor(PRICE_MIN_PADDING_DP, true) + PRICE_MIN_SP * AMOUNT_LINE,
    )
}
