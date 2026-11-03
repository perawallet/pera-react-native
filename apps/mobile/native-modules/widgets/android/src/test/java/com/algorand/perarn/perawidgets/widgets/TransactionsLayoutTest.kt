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

class TransactionsLayoutTest {
    private fun usedHeight(l: TransactionsLayout, hasBar: Boolean): Float {
        val row = if (l.isCompact) TX_ROW_COMPACT_DP else TX_ROW_FULL_DP
        val gap = if (l.isCompact) TX_GAP_COMPACT_DP else TX_GAP_FULL_DP
        val rows = if (l.rowLimit == 0) 0f else l.rowLimit * row + (l.rowLimit - 1) * gap
        return 2 * TX_PADDING_DP + (if (hasBar) NETWORK_BAR_DP else 0f) + LOGO_DP + TX_TITLE_GAP_DP + rows
    }

    @Test fun aTwoByTwoIsCompactAndShowsThreeRows() {
        // 140 × 130 is the step a ColorOS 2x2 gets.
        for ((w, h) in listOf(140f to 130f, 150f to 140f)) {
            val l = transactionsLayout(w, h, hasNetworkBar = false)
            assertTrue(l.isCompact)
            assertEquals("$w x $h", 3, l.rowLimit)
        }
    }

    @Test fun wideRowsPutTheAmountBesideTheLabel() {
        assertFalse(transactionsLayout(250f, 150f, hasNetworkBar = false).isCompact)
    }

    @Test fun rowsNeverOverflowAndNeverExceedTheFetch() {
        for (w in listOf(110f, 150f, 250f, 320f)) for (h in listOf(110f, 150f, 180f, 250f, 400f)) for (bar in listOf(false, true)) {
            val l = transactionsLayout(w, h, bar)
            assertTrue("$w x $h bar=$bar", usedHeight(l, bar) <= h)
            assertTrue(l.rowLimit in 0..TRANSACTIONS_FETCH_LIMIT)
        }
    }

    @Test fun theNetworkBarCanCostARow() {
        assertTrue(transactionsLayout(150f, 150f, true).rowLimit <= transactionsLayout(150f, 150f, false).rowLimit)
    }
}
