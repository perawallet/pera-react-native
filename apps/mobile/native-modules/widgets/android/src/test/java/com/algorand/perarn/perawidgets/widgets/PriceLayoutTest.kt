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

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PriceLayoutTest {
    private fun layout(w: Float, h: Float, chart: Boolean = true, bar: Boolean = false, assetId: Boolean = false) =
        priceLayout(w, h, "$0.2341", bar, assetId, hasChange = true, hasInverse = true, hasChart = chart, hasUpdated = true)

    @Test fun aTwoByTwoShowsEveryLineAndNoChart() {
        val l = layout(170f, 170f)
        assertFalse(l.isWide)
        assertFalse(l.showChart)
        assertTrue(l.showChange && l.showInverse)
        assertTrue(l.priceSp >= TITLE_SP + 4f)
        assertTrue(l.usedDp <= 170f)
    }

    @Test fun wideAddsTheChartBesideTheFigures() {
        val l = layout(250f, 110f)
        assertTrue(l.isWide && l.showChart)
        assertTrue(l.figuresWidthDp + SIDE_GAP_DP + l.chartWidthDp <= 250f - 2 * PADDING_DP + 0.001f)
        assertTrue(l.usedDp <= 110f)
    }

    @Test fun updatedStaysInsideAShortWidget() {
        val l = layout(170f, 70f)
        assertTrue(l.usedDp <= 70f)
        assertFalse(l.showInverse)
    }

    @Test fun theChartNeedsRoomLeftOver() {
        assertEquals(false, layout(300f, 70f).showChart)
    }

    @Test fun theNetworkBarStillFitsTheHeight() {
        assertTrue(layout(170f, 130f, bar = true).usedDp <= 130f)
    }

    @Test fun aShortWidgetKeepsUpdatedForEveryChromeCombination() {
        for (assetId in listOf(false, true)) for (bar in listOf(false, true)) for (w in listOf(170f, 250f)) {
            val l = layout(w, 70f, bar = bar, assetId = assetId)
            assertTrue("w=$w assetId=$assetId bar=$bar used=${l.usedDp}", l.usedDp <= 70f)
            assertTrue(l.priceSp >= PRICE_MIN_SP)
        }
    }

    @Test fun theIdMovesBesideTheTitleRatherThanDisappearing() {
        val l = layout(170f, 70f, assetId = true)
        assertTrue(l.isIdInline)
        assertFalse(layout(170f, 170f, assetId = true).isIdInline)
    }
}
