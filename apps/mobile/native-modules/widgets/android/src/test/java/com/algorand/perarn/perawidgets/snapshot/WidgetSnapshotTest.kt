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
package com.algorand.perarn.perawidgets.snapshot

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class WidgetSnapshotTest {
  private fun fixture(): String =
    requireNotNull(javaClass.classLoader?.getResource("snapshot.json")).readText()

  @Test fun decodesTheFullFixture() {
    val s = WidgetSnapshots.decode(fixture())!!
    assertEquals("MainNet", s.network?.label)
    assertEquals("visible", s.portfolio?.state)
    assertEquals("$1,234.56", s.portfolio?.formatted)
    assertEquals(1761500000000.0, s.portfolio?.asOf!!, 0.0)
    assertEquals("one-week", s.portfolioFeed?.period)
    assertEquals(2, s.portfolioFeed?.accounts?.size)
    assertEquals("algorand:mainnet", s.receiveTargets?.first()?.chain)
    assertEquals("Updated", s.string("updated"))
    assertNull(s.string("missing"))
  }

  @Test fun ignoresUnknownFields() {
    assertNotNull(WidgetSnapshots.decode("""{"version":1,"futureField":{"x":1}}"""))
  }

  @Test fun rejectsAnotherVersion() {
    assertNull(WidgetSnapshots.decode("""{"version":2}"""))
  }

  @Test fun rejectsCorruptJson() {
    assertNull(WidgetSnapshots.decode("""{"version":1"""))
    assertNull(WidgetSnapshots.decode(null))
  }

  @Test fun decodesAHiddenPortfolio() {
    assertEquals("hidden", WidgetSnapshots.decode("""{"version":1,"portfolio":{"state":"hidden"}}""")!!.portfolio?.state)
  }

  @Test fun decodesNftsBackupAndInboxFeed() {
    val s = WidgetSnapshots.decode(fixture())!!
    assertEquals("12345678901234567890", s.nfts?.items?.first()?.assetId)
    assertNull(s.nfts?.items?.first()?.collectionName)
    assertEquals("backedUp", s.backup?.passphrase?.state)
    assertNull(s.backup?.cloud)
    assertEquals("Main", s.inboxFeed?.accountNames?.first()?.name)
    assertNull(s.inboxFeed?.notifications)
  }
}
