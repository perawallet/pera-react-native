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

import kotlin.math.floor

// Tighter than the other widgets so a ColorOS 2x2 (about 146 × 137dp) still fits three rows.
const val TX_PADDING_DP = 12f
const val TX_ROW_COMPACT_DP = 24f
const val TX_GAP_COMPACT_DP = 4f
const val TX_ROW_FULL_DP = 30f
const val TX_GAP_FULL_DP = 5f
const val TX_TITLE_GAP_DP = 4f

data class TransactionsLayout(
    val isCompact: Boolean,
    val rowLimit: Int,
    val topPaddingDp: Float,
    val bottomPaddingDp: Float,
    // Height of every row, for checking against the page.
    val usedDp: Float,
)

// Only whole rows below the title: Glance can't clip a column, so an extra row would push the title out.
// A narrow widget stacks amount over time to save width. A page with a tab bar under it passes its own paddings.
fun transactionsLayout(
    widthDp: Float,
    heightDp: Float,
    hasNetworkBar: Boolean,
    isCompact: Boolean = widthDp < WIDE_FROM_DP,
    topPaddingDp: Float = TX_PADDING_DP,
    bottomPaddingDp: Float = TX_PADDING_DP,
): TransactionsLayout {
    val row = if (isCompact) TX_ROW_COMPACT_DP else TX_ROW_FULL_DP
    val gap = if (isCompact) TX_GAP_COMPACT_DP else TX_GAP_FULL_DP
    val fixed = topPaddingDp + bottomPaddingDp + (if (hasNetworkBar) NETWORK_BAR_DP else 0f) + LOGO_DP + TX_TITLE_GAP_DP
    val rows = floor((heightDp - fixed + gap) / (row + gap)).toInt().coerceIn(0, TRANSACTIONS_FETCH_LIMIT)
    val used = fixed + if (rows == 0) 0f else rows * row + (rows - 1) * gap
    return TransactionsLayout(isCompact, rows, topPaddingDp, bottomPaddingDp, used)
}
