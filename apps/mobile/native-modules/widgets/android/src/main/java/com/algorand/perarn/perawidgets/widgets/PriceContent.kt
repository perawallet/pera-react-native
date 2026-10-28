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

import com.algorand.perarn.perawidgets.config.NATIVE_ASSET_ID
import com.algorand.perarn.perawidgets.config.Period
import com.algorand.perarn.perawidgets.config.PriceOptions
import com.algorand.perarn.perawidgets.config.resolvePriceAssetId
import com.algorand.perarn.perawidgets.fetch.Cached
import com.algorand.perarn.perawidgets.fetch.PriceQuote
import com.algorand.perarn.perawidgets.fetch.QuoteKeys
import com.algorand.perarn.perawidgets.format.PriceFormat
import com.algorand.perarn.perawidgets.format.QuoteCurrency
import com.algorand.perarn.perawidgets.format.UpdatedTime
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import com.algorand.perarn.perawidgets.snapshot.string
import java.time.Instant
import java.time.ZoneId
import java.util.Locale

data class PriceContent(
    val title: String,
    // Shown for anything but ALGO: a look-alike asset can copy a name but not an id.
    val assetIdLine: String?,
    val price: String?,
    val change: String?,
    val isTrendUp: Boolean,
    val inverse: String?,
    val chart: List<Double>?,
    val updatedText: String?,
    val tapUrl: String,
)

private const val FALLBACK_PERIOD = "one-week"
private const val ALGO_CODE = "ALGO"

fun pricePeriod(snapshot: WidgetSnapshot, options: PriceOptions): String =
    options.period.api ?: snapshot.portfolioFeed?.period ?: FALLBACK_PERIOD

// ALGO priced in ALGO says nothing, so that combination uses the app's currency, as on iOS.
// Null without an app currency: guessing one would quote the wrong currency.
fun priceQuoteCurrency(snapshot: WidgetSnapshot, options: PriceOptions, assetId: String): QuoteCurrency? {
    val appCurrency = snapshot.priceFeed?.currencyCode?.takeIf { it.isNotBlank() }?.let { QuoteCurrency.Fiat(it) }
    return when (val code = options.currencyCode) {
        null -> appCurrency
        ALGO_CODE -> if (assetId == NATIVE_ASSET_ID) appCurrency else QuoteCurrency.Algo
        else -> QuoteCurrency.Fiat(code)
    }
}

fun priceQuoteKey(snapshot: WidgetSnapshot, options: PriceOptions): String? {
    val feed = snapshot.priceFeed ?: return null
    val assetId = resolvePriceAssetId(options, snapshot)
    val quote = priceQuoteCurrency(snapshot, options, assetId) ?: return null
    return QuoteKeys.price(feed.backendUrl, assetId, pricePeriod(snapshot, options), quote)
}

fun priceContent(
    snapshot: WidgetSnapshot,
    options: PriceOptions,
    cached: Cached<PriceQuote>?,
    now: Instant,
    locale: Locale,
    zone: ZoneId,
    is24Hour: Boolean,
    patterns: (Locale, String) -> String,
): PriceContent {
    val assetId = resolvePriceAssetId(options, snapshot)
    val isNative = assetId == NATIVE_ASSET_ID
    val quote = cached?.value
    // The app only writes the ALGO price, in its own currency; any other asset shows nothing without a quote.
    val fallback = if (isNative && options.currencyCode == null) snapshot.algoPrice else null

    val unitName = quote?.unitName
        ?: snapshot.assetOptions?.firstOrNull { it.assetId == assetId }?.let { it.unitName ?: it.name }
        ?: assetId

    val price = if (quote != null) PriceFormat.price(quote.price, quote.quote, locale) else fallback?.formatted

    val change = quote?.change24h
    val changeText = change?.let { "${if (it >= 0) "▲" else "▼"} ${PriceFormat.percent(it, locale)} 24h" }

    val inverse = if (options.showAssetPerCurrency && quote != null) {
        PriceFormat.inverse(quote.price, quote.quote, quote.unitName, locale)
    } else {
        null
    }

    val updated = quote?.fetchedAt ?: fallback?.asOf?.let { Instant.ofEpochMilli(it.toLong()) }
    val updatedText = updated?.let {
        listOfNotNull(snapshot.string("updated"), UpdatedTime.text(it, now, locale, zone, is24Hour, patterns)).joinToString(" ")
    }

    return PriceContent(
        title = if (isNative) snapshot.string("algoPrice") ?: "ALGO" else unitName,
        assetIdLine = if (isNative) null else "ID $assetId",
        price = price,
        change = changeText,
        isTrendUp = (change ?: 0.0) >= 0,
        inverse = inverse,
        chart = quote?.chart?.takeIf { it.size > 1 },
        updatedText = updatedText,
        tapUrl = "perawallet://app/",
    )
}
