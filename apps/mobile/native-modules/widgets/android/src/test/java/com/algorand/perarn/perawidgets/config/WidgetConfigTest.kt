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
package com.algorand.perarn.perawidgets.config

import com.algorand.perarn.perawidgets.fetch.InMemoryStore
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot.PortfolioFeed
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot.ReceiveTarget
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WidgetConfigTest {
  private val store = InMemoryStore()
  private val config = WidgetConfig(store)

  private fun snapshotWith(accounts: List<String> = emptyList(), targets: List<String> = emptyList()) =
    WidgetSnapshot(
      version = 1,
      portfolioFeed = PortfolioFeed(accounts = accounts.map { PortfolioFeed.Account(it, "n$it") }),
      receiveTargets = targets.map { ReceiveTarget(address = it, name = "n$it") },
    )

  @Test fun defaultsMatchIos() {
    assertEquals(PortfolioOptions(Period.Default, true, null), config.portfolio(7))
    assertEquals(PriceOptions("0", null, Period.Week, true), config.price(7))
    assertEquals(ReceiveOptions(null), config.receive(7))
  }

  @Test fun savedOptionsRoundTripPerWidget() {
    config.save(7, PriceOptions("31566704", "EUR", Period.Year, false))
    config.save(8, PortfolioOptions(Period.Day, false, "A"))
    assertEquals(PriceOptions("31566704", "EUR", Period.Year, false), config.price(7))
    assertEquals(PortfolioOptions(Period.Day, false, "A"), config.portfolio(8))
    assertEquals("0", config.price(8).assetId)
  }

  @Test fun corruptStoredOptionsFallBackToDefaults() {
    store.put("price.7", "{nope")
    assertEquals(PriceOptions(), config.price(7))
  }

  @Test fun deleteForgetsTheWidget() {
    config.save(7, PriceOptions(assetId = "31566704"))
    config.save(7, ReceiveOptions("A"))
    config.delete(7)
    assertEquals("0", config.price(7).assetId)
    assertNull(config.receive(7).accountAddress)
  }

  @Test fun aRemovedAccountFallsBackToAllAccounts() {
    assertNull(resolvePortfolioAccount(PortfolioOptions(accountAddress = "GONE"), snapshotWith(accounts = listOf("A"))))
    assertEquals("A", resolvePortfolioAccount(PortfolioOptions(accountAddress = "A"), snapshotWith(accounts = listOf("A")))!!.address)
  }

  @Test fun aRemovedReceiveAccountFallsBackToTheFirst() {
    assertEquals("A", resolveReceiveTarget(ReceiveOptions("GONE"), snapshotWith(targets = listOf("A", "B")))!!.address)
    assertEquals("B", resolveReceiveTarget(ReceiveOptions("B"), snapshotWith(targets = listOf("A", "B")))!!.address)
    assertNull(resolveReceiveTarget(ReceiveOptions(), snapshotWith()))
  }

  @Test fun providerClassNamesMapToKinds() {
    assertEquals(WidgetKind.Price, widgetKindFor("com.algorand.perarn.perawidgets.widgets.PriceWidgetReceiver"))
    assertNull(widgetKindFor("other.Receiver"))
  }

  @Test fun currencyChoicesAreDedupedAndStartWithDefault() {
    val snap = WidgetSnapshot(version = 1, priceFeed = WidgetSnapshot.PriceFeed(currencyCode = "USD"))
    assertEquals(listOf(null, "USD", "EUR"), WidgetChoices.currencies(snap).map { it.value })
  }

  @Test fun assetChoicesStartWithAlgoAndSkipDuplicates() {
    val snap = WidgetSnapshot(
      version = 1,
      assetOptions = listOf(
        WidgetSnapshot.AssetOption("0", "Algorand", "ALGO"),
        WidgetSnapshot.AssetOption("31566704", "USDC", "USDC"),
      ),
    )
    assertEquals(listOf("0", "31566704"), WidgetChoices.assets(snap).map { it.value })
  }

  private val usdc = WidgetSnapshot(version = 1, assetOptions = listOf(WidgetSnapshot.AssetOption("31566704", "USDC", "USDC")))

  @Test fun aRemovedPriceAssetFallsBackToAlgo() {
    assertEquals("0", resolvePriceAssetId(PriceOptions(assetId = "999"), usdc))
  }

  @Test fun aPresentPriceAssetIsKept() {
    assertEquals("31566704", resolvePriceAssetId(PriceOptions(assetId = "31566704"), usdc))
  }

  @Test fun privacyModeFallsBackToAlgo() {
    assertEquals("0", resolvePriceAssetId(PriceOptions(assetId = "31566704"), WidgetSnapshot(version = 1)))
    assertEquals("0", resolvePriceAssetId(PriceOptions(assetId = "31566704"), null))
  }

  @Test fun algoIsAlwaysKept() {
    assertEquals("0", resolvePriceAssetId(PriceOptions(), WidgetSnapshot(version = 1)))
  }

  @Test fun assetsWithoutAnIdAreSkippedAndNameFallsBack() {
    val snap = WidgetSnapshot(
      version = 1,
      assetOptions = listOf(
        WidgetSnapshot.AssetOption(null, "NoId", "NI"),
        WidgetSnapshot.AssetOption("5", "Five", null),
        WidgetSnapshot.AssetOption("6", null, null),
      ),
    )
    assertEquals(listOf("0", "5", "6"), WidgetChoices.assets(snap).map { it.value })
    assertEquals(listOf("ALGO", "Five", "6"), WidgetChoices.assets(snap).map { it.label })
  }

  @Test fun portfolioAccountsWithoutAnAddressAreSkipped() {
    val snap = WidgetSnapshot(
      version = 1,
      portfolioFeed = PortfolioFeed(accounts = listOf(PortfolioFeed.Account(null, "X"), PortfolioFeed.Account("A", null))),
    )
    val choices = WidgetChoices.portfolioAccounts(snap)
    assertEquals(listOf(null, "A"), choices.map { it.value })
    assertEquals("A", choices[1].label)
  }
}
