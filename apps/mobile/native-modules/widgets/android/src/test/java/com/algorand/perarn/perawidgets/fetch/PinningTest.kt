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
package com.algorand.perarn.perawidgets.fetch

import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot.PriceFeed.Pinning as SnapshotPinning
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PinningTest {
    private val now = Instant.parse("2026-11-03T12:00:00Z")
    private val key = "pinned-key".toByteArray()
    private val other = "other-key".toByteArray()
    private val pin = Pinning.spkiHash(key)

    @Test fun hashesTheKeyAsBase64Sha256() {
        assertEquals(44, pin.length)
        // The SHA-256 of nothing, as openssl dgst -sha256 -binary | base64 prints it.
        assertEquals("47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=", Pinning.spkiHash(ByteArray(0)))
    }

    @Test fun anyPinnedKeyInTheChainPasses() {
        assertTrue(Pinning.isPinned(listOf(other, key), setOf(pin)))
        assertFalse(Pinning.isPinned(listOf(other), setOf(pin)))
    }

    @Test fun anEmptyPinSetFailsClosed() = assertFalse(Pinning.isPinned(listOf(key), emptySet()))

    @Test fun pinsApplyUntilTheyExpire() {
        val pinning = SnapshotPinning(listOf(pin), "2027-07-08")
        assertEquals(setOf(pin), Pinning.activePins(pinning, now))
        assertNull(Pinning.activePins(pinning, Instant.parse("2027-07-08T00:00:00Z")))
        assertEquals(setOf(pin), Pinning.activePins(SnapshotPinning(listOf(pin), "2026-11-03T12:00:01Z"), now))
        assertNull(Pinning.activePins(SnapshotPinning(listOf(pin), "2026-11-03T13:00:00+02:00"), now))
    }

    @Test fun noPinningMeansPlainTls() = assertNull(Pinning.activePins(null, now))

    @Test fun anUnreadableExpiryKeepsThePins() {
        assertEquals(setOf(pin), Pinning.activePins(SnapshotPinning(listOf(pin), "soon"), now))
        assertEquals(setOf(pin), Pinning.activePins(SnapshotPinning(listOf(pin), null), now))
    }

    @Test fun pinningWithoutHashesFailsClosed() =
        assertEquals(emptySet<String>(), Pinning.activePins(SnapshotPinning(null, "2027-07-08"), now))
}
