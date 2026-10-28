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

class PortfolioLayoutTest {
    private val SECONDARY = "≈ \$1,234.56"

    @Test fun aTwoByTwoAmountIsClearlyLargerThanTheTitle() {
        val l = portfolioLayout(170f, 170f, "6,500.10 ALGO", hasNetworkBar = false, secondary = SECONDARY, hasChart = true, hasUpdated = true)
        assertFalse(l.isWide)
        assertTrue(l.amountSp >= TITLE_SP + 4f)
        assertTrue(l.chartHeightDp > 40f)
    }

    @Test fun wideGivesTheChartTheFullContentWidth() {
        val l = portfolioLayout(300f, 110f, "6,500.10 ALGO", hasNetworkBar = false, secondary = SECONDARY, hasChart = true, hasUpdated = true)
        assertTrue(l.isWide)
        assertEquals(300f - 2 * PADDING_DP, l.chartWidthDp, 0.001f)
    }

    @Test fun theNetworkBarShortensTheChart() {
        val plain = portfolioLayout(170f, 170f, "1 ALGO", false, SECONDARY, true, true)
        val bar = portfolioLayout(170f, 170f, "1 ALGO", true, SECONDARY, true, true)
        assertEquals(NETWORK_BAR_DP, plain.chartHeightDp - bar.chartHeightDp, 0.001f)
    }

    @Test fun everySizeKeepsTheRowsInsideTheWidget() {
        listOf(250f to 110f, 300f to 110f, 170f to 70f, 170f to 170f).forEach { (w, h) ->
            val l = portfolioLayout(w, h, "6,500.10 ALGO", false, SECONDARY, true, true)
            assertTrue("\$w x \$h used \${l.usedDp}", l.usedDp <= h)
            assertTrue(l.amountSp >= TITLE_SP)
        }
    }

    @Test fun aTwoByTwoStillShowsTheChartAndTheSecondLine() {
        val l = portfolioLayout(170f, 170f, "6,500.10 ALGO", false, SECONDARY, true, true)
        assertTrue(l.showChart)
        assertTrue(l.showSecondary)
    }

    @Test fun theDefaultWideKeepsItsChartAndTheSecondLineBesideTheAmount() {
        listOf(250f, 300f).forEach { w ->
            val l = portfolioLayout(w, 110f, "6,500.10 ALGO", false, SECONDARY, true, true)
            assertTrue(l.showChart)
            assertTrue(l.showSecondary)
            assertTrue(l.usedDp <= 110f)
        }
    }

    @Test fun aSecondLineThatCannotFitBesideTheAmountIsDropped() {
        val l = portfolioLayout(250f, 110f, "123,456,789.12 ALGO", false, "≈ \$12,345,678.90", true, true)
        assertFalse(l.showSecondary)
        assertTrue(l.showChart)
    }

    @Test fun aShortNarrowWidgetDropsTheChartBeforeTheSecondLine() {
        val l = portfolioLayout(170f, 100f, "6,500.10 ALGO", false, SECONDARY, true, true)
        assertFalse(l.showChart)
        assertTrue(l.showSecondary)
        assertTrue(l.usedDp <= 100f)
    }

    @Test fun aShortWidgetWithTheNetworkBarStaysInsideItsHeight() {
        for (w in listOf(170f, 250f)) {
            val l = portfolioLayout(w, 70f, "6,500.10 ALGO", hasNetworkBar = true, secondary = SECONDARY, hasChart = true, hasUpdated = true)
            assertTrue("w=$w used=${l.usedDp}", l.usedDp <= 70f)
        }
    }
}
