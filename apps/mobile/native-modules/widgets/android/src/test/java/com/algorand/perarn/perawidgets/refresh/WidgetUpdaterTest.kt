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
package com.algorand.perarn.perawidgets.refresh

import com.algorand.perarn.perawidgets.fetch.InMemoryStore
import com.algorand.perarn.perawidgets.fetch.QuoteCache
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetUpdaterTest {
    @Test fun writesOnlyRedrawWhenTheJsonChanged() {
        assertTrue(shouldRedraw(null, "{}"))
        assertTrue(shouldRedraw("{\"a\":1}", "{\"a\":2}"))
        assertFalse(shouldRedraw("{\"a\":1}", "{\"a\":1}"))
    }

    @Test fun everyBumpChangesTheState() {
        assertEquals(1, WidgetVersion.next(null))
        assertEquals(8, WidgetVersion.next(7))
    }

    @Test fun refreshStopsOnlyWhenNoKindHasAWidget() {
        assertTrue(noWidgetsLeft(intArrayOf(), intArrayOf(), intArrayOf()))
        assertFalse(noWidgetsLeft(intArrayOf(), intArrayOf(7), intArrayOf()))
        assertFalse(noWidgetsLeft(intArrayOf(1), intArrayOf(), intArrayOf(2, 3)))
    }

    @Test fun clearRemovesOnlyThatWidgetsQuotes() {
        val cache = QuoteCache(InMemoryStore())
        cache.put(1, "a", "x")
        cache.put(1, "b", "y")
        cache.put(10, "a", "z")
        cache.clear(1)
        assertNull(cache.get<String>(1, "a"))
        assertNull(cache.get<String>(1, "b"))
        assertEquals("z", cache.get<String>(10, "a")!!.value)
    }
}
