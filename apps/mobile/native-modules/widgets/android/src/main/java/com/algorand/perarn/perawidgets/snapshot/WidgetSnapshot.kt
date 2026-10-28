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

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// Mirrors widgetSnapshotSchema (snapshot.ts) and WidgetSnapshot.swift. Every
// field is nullable so an older widget still decodes a newer snapshot.
@Serializable
data class WidgetSnapshot(
  val version: Int,
  val locale: String? = null,
  val theme: String? = null,
  val network: Network? = null,
  val strings: Map<String, String>? = null,
  val priceFeed: PriceFeed? = null,
  val portfolioFeed: PortfolioFeed? = null,
  val assetOptions: List<AssetOption>? = null,
  val algoPrice: Price? = null,
  val portfolio: Portfolio? = null,
  val nfts: Nfts? = null,
  val backup: Backup? = null,
  val receiveTargets: List<ReceiveTarget>? = null,
  val inboxFeed: InboxFeed? = null,
) {
  @Serializable
  data class Network(val isMainnet: Boolean? = null, val label: String? = null)

  @Serializable
  data class PriceFeed(
    val backendUrl: String? = null,
    val apiKey: String? = null,
    val currencyCode: String? = null,
  )

  @Serializable
  data class PortfolioFeed(
    val accounts: List<Account>? = null,
    // one-day | one-week | one-month | one-year
    val period: String? = null,
  ) {
    @Serializable
    data class Account(val address: String? = null, val name: String? = null)
  }

  @Serializable
  data class AssetOption(
    val assetId: String? = null,
    val name: String? = null,
    val unitName: String? = null,
  )

  // asOf is epoch milliseconds.
  @Serializable
  data class Price(val formatted: String? = null, val asOf: Double? = null)

  @Serializable
  data class Portfolio(
    val state: String? = null,
    val formatted: String? = null,
    val algoFormatted: String? = null,
    val asOf: Double? = null,
  )

  @Serializable
  data class Nft(
    val assetId: String? = null,
    val title: String? = null,
    val collectionName: String? = null,
    val imageKey: String? = null,
  )

  @Serializable
  data class Nfts(val state: String? = null, val items: List<Nft>? = null)

  @Serializable
  data class Backup(val cloud: Line? = null, val passphrase: Line? = null) {
    @Serializable
    data class Line(
      val state: String? = null,
      val title: String? = null,
      val detail: String? = null,
    )
  }

  @Serializable
  data class InboxFeed(
    val deviceId: String? = null,
    val addresses: List<String>? = null,
    val accountNames: List<AccountName>? = null,
    val notifications: Notifications? = null,
  ) {
    @Serializable
    data class AccountName(val address: String? = null, val name: String? = null)

    @Serializable
    data class Notifications(val backendUrl: String? = null, val deviceId: String? = null)
  }

  @Serializable
  data class ReceiveTarget(
    val address: String? = null,
    val name: String? = null,
    val paymentUri: String? = null,
    val chain: String? = null,
  )
}

fun WidgetSnapshot.string(key: String): String? = strings?.get(key)

object WidgetSnapshots {
  const val SUPPORTED_VERSION = 1

  private val json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
  }

  fun decode(json: String?): WidgetSnapshot? {
    if (json == null) return null
    return try {
      this.json.decodeFromString<WidgetSnapshot>(json).takeIf { it.version == SUPPORTED_VERSION }
    } catch (_: Exception) {
      null
    }
  }
}
