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
import org.junit.Assert.assertTrue
import org.junit.Test

class ReceiveLayoutTest {
    private val sizes = listOf(110f to 110f, 150f to 150f, 170f to 110f, 170f to 170f, 110f to 170f, 250f to 250f)

    private fun check(w: Float, h: Float, hasBar: Boolean) {
        val layout = receiveLayout(w, h, hasBar)
        val tag = "$w x $h bar=$hasBar"
        val qrLeft = (w - layout.sideDp) / 2 - layout.shiftLeftDp
        val qrRight = qrLeft + layout.sideDp
        val logoLeft = w - QR_LOGO_MARGIN_DP - LOGO_DP
        val logoBottom = QR_LOGO_MARGIN_DP + LOGO_DP
        assertTrue(tag, qrRight <= logoLeft - QR_LOGO_CLEARANCE_DP || layout.topDp >= logoBottom)
        assertTrue(tag, qrLeft >= QR_PADDING_DP)
        val usable = h - if (hasBar) NetworkBarHeight.value else 0f
        assertTrue(tag, layout.topDp + layout.sideDp + QR_GAP_DP + QR_LABEL_DP + QR_PADDING_DP <= usable)
    }

    @Test
    fun theQrNeverCollidesWithTheCornerLogoOrPushesTheLabelOut() {
        for ((w, h) in sizes) {
            check(w, h, false)
            check(w, h, true)
        }
    }

    @Test
    fun theQrStaysLargeAtCommonTwoByTwoSizes() {
        assertTrue(receiveLayout(150f, 150f).sideDp >= 100f)
        assertTrue(receiveLayout(170f, 170f).sideDp >= 100f)
    }

    @Test
    fun aSmallShiftKeepsTheQrFlushAtTheTop() {
        val layout = receiveLayout(150f, 150f)
        assertTrue(layout.topDp == QR_PADDING_DP)
        assertTrue(layout.shiftLeftDp > 0f && layout.shiftLeftDp <= QR_MAX_SHIFT_DP)
    }

    @Test
    fun theNetworkBarShrinksTheQr() {
        assertTrue(receiveLayout(170f, 170f, true).sideDp < receiveLayout(170f, 170f, false).sideDp)
    }
}
