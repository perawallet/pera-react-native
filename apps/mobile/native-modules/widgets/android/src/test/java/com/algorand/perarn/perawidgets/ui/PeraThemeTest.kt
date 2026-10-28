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
package com.algorand.perarn.perawidgets.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PeraThemeTest {
    @Test fun anExplicitThemeBeatsThePhone() {
        assertFalse(PeraTheme.isDark("light", systemIsDark = true))
        assertTrue(PeraTheme.isDark("dark", systemIsDark = false))
    }

    @Test fun systemOrUnknownFollowsThePhone() {
        assertTrue(PeraTheme.isDark("system", systemIsDark = true))
        assertTrue(PeraTheme.isDark(null, systemIsDark = true))
        assertFalse(PeraTheme.isDark("system", systemIsDark = false))
    }

    @Test fun textShrinksToFitButNeverBelowTheFloor() {
        assertEquals(22f, fittedTextSize("1", availableDp = 200f, maxSp = 22f, minSp = 11f), 0.001f)
        assertEquals(11f, fittedTextSize("6,500.10 ALGO and more", availableDp = 40f, maxSp = 22f, minSp = 11f), 0.001f)
        val mid = fittedTextSize("6,500.10 ALGO", availableDp = 100f, maxSp = 22f, minSp = 11f)
        assertTrue(mid in 11f..22f)
    }
}
