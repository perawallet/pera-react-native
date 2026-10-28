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

import com.algorand.perarn.perawidgets.ui.NetworkBarHeight

const val QR_PADDING_DP = 12f
const val QR_LABEL_DP = 16f
const val QR_GAP_DP = 6f
const val QR_LOGO_MARGIN_DP = 8f
const val QR_LOGO_CLEARANCE_DP = 2f
const val QR_MAX_SHIFT_DP = 12f

// shiftLeftDp moves the centred QR left, away from the corner logo.
data class ReceiveLayout(val sideDp: Float, val topDp: Float, val shiftLeftDp: Float)

// The quiet zone must stay clear of the logo: nudge the QR left when it fits, otherwise drop it below the logo.
fun receiveLayout(widthDp: Float, heightDp: Float, hasNetworkBar: Boolean = false): ReceiveLayout {
    val height = heightDp - if (hasNetworkBar) NetworkBarHeight.value else 0f
    fun fit(top: Float) = minOf(widthDp - 2 * QR_PADDING_DP, height - top - QR_PADDING_DP - QR_LABEL_DP - QR_GAP_DP).coerceAtLeast(0f)

    val logoLeft = widthDp - QR_LOGO_MARGIN_DP - LOGO_DP
    val side = fit(QR_PADDING_DP)
    val shift = ((widthDp + side) / 2 - (logoLeft - QR_LOGO_CLEARANCE_DP)).coerceAtLeast(0f)
    if (shift <= QR_MAX_SHIFT_DP && side + 2 * shift <= widthDp - 2 * QR_PADDING_DP) {
        return ReceiveLayout(side, QR_PADDING_DP, shift)
    }
    val belowLogo = QR_LOGO_MARGIN_DP + LOGO_DP + QR_LOGO_CLEARANCE_DP
    return ReceiveLayout(fit(belowLogo), belowLogo, 0f)
}
