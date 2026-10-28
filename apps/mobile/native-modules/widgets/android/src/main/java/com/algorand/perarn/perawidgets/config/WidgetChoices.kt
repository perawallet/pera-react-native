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

import com.algorand.perarn.perawidgets.R
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot

enum class WidgetKind { Portfolio, Price, Receive }

private const val PACKAGE = "com.algorand.perarn.perawidgets.widgets"

fun widgetKindFor(providerClassName: String?): WidgetKind? =
  when (providerClassName) {
    "$PACKAGE.PortfolioWidgetReceiver" -> WidgetKind.Portfolio
    "$PACKAGE.PriceWidgetReceiver" -> WidgetKind.Price
    "$PACKAGE.ReceiveWidgetReceiver" -> WidgetKind.Receive
    else -> null
  }

// Either a literal name from the snapshot or a string resource; never both.
data class Choice<T>(val value: T, val label: String? = null, val labelRes: Int? = null)

object WidgetChoices {
  val periods: List<Choice<Period>> = listOf(
    Choice(Period.Default, labelRes = R.string.options_period_default),
    Choice(Period.Day, labelRes = R.string.options_period_one_day),
    Choice(Period.Week, labelRes = R.string.options_period_one_week),
    Choice(Period.Month, labelRes = R.string.options_period_one_month),
    Choice(Period.Year, labelRes = R.string.options_period_one_year),
  )

  fun portfolioAccounts(snapshot: WidgetSnapshot?): List<Choice<String?>> =
    listOf(Choice<String?>(null, labelRes = R.string.options_portfolio)) +
      snapshot?.portfolioFeed?.accounts.orEmpty().mapNotNull { account ->
        account.address?.let { Choice<String?>(it, label = account.name ?: it) }
      }

  fun receiveAccounts(snapshot: WidgetSnapshot?): List<Choice<String?>> =
    snapshot?.receiveTargets.orEmpty().mapNotNull { target ->
      target.address?.let { Choice<String?>(it, label = target.name ?: it) }
    }

  fun assets(snapshot: WidgetSnapshot?): List<Choice<String>> =
    listOf(Choice(NATIVE_ASSET_ID, label = "ALGO")) +
      snapshot?.assetOptions.orEmpty().mapNotNull { asset ->
        asset.assetId?.takeIf { it != NATIVE_ASSET_ID }?.let { Choice(it, label = asset.unitName ?: asset.name ?: it) }
      }.distinctBy { it.value }

  fun currencies(snapshot: WidgetSnapshot?): List<Choice<String?>> {
    val codes = listOfNotNull(snapshot?.priceFeed?.currencyCode, "USD", "EUR").distinct()
    return listOf(Choice<String?>(null, labelRes = R.string.options_default)) + codes.map { Choice<String?>(it, label = it) }
  }
}
