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

import com.algorand.perarn.perawidgets.config.ReceiveOptions
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ReceiveContentTest {
    private val first = WidgetSnapshot.ReceiveTarget("AAA", "Main", "algorand://AAA", null)
    private val second = WidgetSnapshot.ReceiveTarget("BBB", "Savings", "algorand://BBB?amount=1", "eip155:1")

    private fun snapshot(targets: List<WidgetSnapshot.ReceiveTarget>?) =
        WidgetSnapshot(version = 1, locale = "en-US", receiveTargets = targets)

    @Test
    fun privacyModeShowsOnlyTheLogo() {
        assertNull(receiveContent(snapshot(null), ReceiveOptions(accountAddress = "AAA")))
    }

    @Test
    fun noTargetsShowsOnlyTheLogo() {
        assertNull(receiveContent(snapshot(emptyList()), ReceiveOptions()))
        assertNull(receiveContent(null, ReceiveOptions()))
    }

    @Test
    fun aRemovedAccountShowsTheFirstTarget() {
        val content = receiveContent(snapshot(listOf(first, second)), ReceiveOptions(accountAddress = "GONE"))!!
        assertEquals("Main", content.label)
        assertEquals("algorand://AAA", content.payload)
    }

    @Test
    fun thePickedAccountIsShown() {
        val content = receiveContent(snapshot(listOf(first, second)), ReceiveOptions(accountAddress = "BBB"))!!
        assertEquals("Savings", content.label)
        assertEquals("algorand://BBB?amount=1", content.payload)
    }

    @Test
    fun tapCarriesTheChainWhenKnown() {
        val content = receiveContent(snapshot(listOf(first, second)), ReceiveOptions(accountAddress = "BBB"))!!
        assertEquals("perawallet://app/account-detail/?address=BBB&chain=eip155:1", content.tapUrl)
    }

    @Test
    fun tapOmitsTheChainWhenUnknown() {
        val content = receiveContent(snapshot(listOf(first)), ReceiveOptions())!!
        assertEquals("perawallet://app/account-detail/?address=AAA", content.tapUrl)
    }

    @Test
    fun tapEncodesSpecialCharacters() {
        assertEquals("perawallet://app/account-detail/?address=a%20b%26c&chain=x%3Dy", accountUrl("a b&c", "x=y"))
    }
}
