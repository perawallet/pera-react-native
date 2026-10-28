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

import com.algorand.perarn.perawidgets.config.PortfolioOptions
import com.algorand.perarn.perawidgets.config.resolvePortfolioAccount
import com.algorand.perarn.perawidgets.fetch.Cached
import com.algorand.perarn.perawidgets.fetch.PortfolioQuote
import com.algorand.perarn.perawidgets.fetch.QuoteKeys
import com.algorand.perarn.perawidgets.format.PriceFormat
import com.algorand.perarn.perawidgets.format.UpdatedTime
import com.algorand.perarn.perawidgets.snapshot.WidgetSnapshot
import com.algorand.perarn.perawidgets.snapshot.string
import java.time.Instant
import java.time.ZoneId
import java.util.Locale

data class PortfolioContent(
    val title: String,
    val primary: String?,
    val secondary: String?,
    val chart: List<Double>?,
    val isTrendUp: Boolean,
    val updatedText: String?,
    val tapUrl: String,
)

private const val HIDDEN = "••••"
private const val FALLBACK_PERIOD = "one-week"

fun portfolioAddresses(snapshot: WidgetSnapshot, options: PortfolioOptions): List<String> {
    val account = resolvePortfolioAccount(options, snapshot)?.address
    return if (account != null) listOf(account) else snapshot.portfolioFeed?.accounts.orEmpty().mapNotNull { it.address }
}

fun portfolioPeriod(snapshot: WidgetSnapshot, options: PortfolioOptions): String =
    options.period.api ?: snapshot.portfolioFeed?.period ?: FALLBACK_PERIOD

fun portfolioQuoteKey(snapshot: WidgetSnapshot, options: PortfolioOptions): String? {
    val feed = snapshot.priceFeed ?: return null
    if (snapshot.portfolioFeed == null) return null
    return QuoteKeys.portfolio(
        feed.backendUrl,
        portfolioAddresses(snapshot, options),
        portfolioPeriod(snapshot, options),
        feed.currencyCode,
    )
}

fun portfolioContent(
    snapshot: WidgetSnapshot,
    options: PortfolioOptions,
    cached: Cached<PortfolioQuote>?,
    now: Instant,
    locale: Locale,
    zone: ZoneId,
    is24Hour: Boolean,
    patterns: (Locale, String) -> String,
): PortfolioContent {
    val account = resolvePortfolioAccount(options, snapshot)
    val portfolio = snapshot.portfolio
    val isHidden = portfolio?.state == "hidden"
    val quote = cached?.value
    // The snapshot only holds the all-accounts total, so one account without a quote shows nothing.
    val fallback = if (account == null) portfolio else null

    val primary = when {
        isHidden -> HIDDEN
        quote != null -> PriceFormat.algo(quote.algo, locale)
        else -> fallback?.algoFormatted
    }

    val fiat = if (isHidden) {
        null
    } else if (quote != null) {
        quote.fiat?.let { PriceFormat.currency(it, quote.currencyCode, locale) }
    } else {
        fallback?.formatted
    }
    val secondary = fiat?.takeIf { it != portfolio?.algoFormatted }?.let { "≈ $it" }

    val chart = quote?.chart?.takeIf { !isHidden && options.showChart && it.size > 1 }

    val updated = when {
        isHidden -> null
        quote != null -> quote.fetchedAt
        else -> fallback?.asOf?.let { Instant.ofEpochMilli(it.toLong()) }
    }
    val updatedText = updated?.let {
        listOfNotNull(snapshot.string("updated"), UpdatedTime.text(it, now, locale, zone, is24Hour, patterns)).joinToString(" ")
    }

    return PortfolioContent(
        title = account?.name ?: snapshot.string("portfolio") ?: "Portfolio",
        primary = primary,
        secondary = secondary,
        chart = chart,
        isTrendUp = (quote?.change ?: 0.0) >= 0,
        updatedText = updatedText,
        tapUrl = account?.address?.let { "perawallet://app/account-detail/?address=$it" }
            ?: "perawallet://app/portfolio/",
    )
}
