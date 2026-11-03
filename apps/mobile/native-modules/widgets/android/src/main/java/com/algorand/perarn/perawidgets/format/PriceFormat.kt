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
package com.algorand.perarn.perawidgets.format

import java.math.BigDecimal
import java.math.BigInteger
import java.math.MathContext
import java.math.RoundingMode
import java.text.DecimalFormatSymbols
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

sealed interface QuoteCurrency {
    val code: String

    data class Fiat(override val code: String) : QuoteCurrency

    data object Algo : QuoteCurrency {
        override val code = "ALGO"
    }
}

// Ports the app's formatCurrency/formatNumber (wallet-core-shared) and CurrencyAmount's precision rules, so a
// figure the widget formats reads like the same figure in the app and in the snapshot's own strings.
object PriceFormat {
    private const val DEFAULT_PRECISION = 2
    private const val UNIT_PRICE_PRECISION = 6
    private const val ALGO = "ALGO"
    private val symbols = mapOf("USD" to "$", "EUR" to "€", "GBP" to "£")

    // formatCurrency: half-up to `precision`, trailing zeros trimmed down to `minPrecision` (or `precision`), the
    // symbol (or code) before the number with a space, and none for ALGO.
    fun formatCurrency(
        value: BigDecimal,
        precision: Int,
        code: String,
        locale: Locale,
        showSymbol: Boolean = true,
        minPrecision: Int? = null,
    ): String {
        val digits = maxOf(precision, minPrecision ?: 0)
        val fixed = value.setScale(digits, RoundingMode.HALF_UP).toPlainString()
        val sign = if (fixed.startsWith("-")) "-" else ""
        val unsigned = fixed.removePrefix("-")
        val integer = NumberFormat.getIntegerInstance(locale).format(BigInteger(unsigned.substringBefore('.')))
        var fraction = if (unsigned.contains('.')) {
            DecimalFormatSymbols.getInstance(locale).decimalSeparator + unsigned.substringAfter('.')
        } else {
            ""
        }
        val keep = minPrecision ?: precision
        while (fraction.length - 1 > keep && fraction.endsWith('0')) fraction = fraction.dropLast(1)
        val symbol = if (!showSymbol || code == ALGO) null else symbols[code] ?: code
        return sign + (symbol?.let { "$it " } ?: "") + integer + (if (fraction.length > 1) fraction else "")
    }

    // A preferred-currency amount: an ISO currency at its minor-unit digits capped at the app's 2 (JPY 0, KWD 2), a
    // positive amount under the smallest unit as "< $ 0.01". A code ISO doesn't know is not fiat, so it gets the
    // app's non-fiat digits.
    fun currency(value: BigDecimal, code: String, locale: Locale): String {
        val digits = isoDigits(code)?.coerceAtMost(DEFAULT_PRECISION) ?: return formatCurrency(value, UNIT_PRICE_PRECISION, code, locale, minPrecision = DEFAULT_PRECISION)
        val smallest = BigDecimal.ONE.movePointLeft(digits)
        if (value.signum() > 0 && value < smallest) return "< " + formatCurrency(smallest, digits, code, locale, minPrecision = digits)
        return formatCurrency(value, digits, code, locale, minPrecision = digits)
    }

    // The price of one unit of an asset: 2 to 6 decimals in any currency, since a cheap token's price is all
    // sub-cent digits. ALGO has no symbol, so it is named after the number.
    fun price(value: BigDecimal, quote: QuoteCurrency, locale: Locale): String {
        val formatted = formatCurrency(value, UNIT_PRICE_PRECISION, quote.code, locale, minPrecision = DEFAULT_PRECISION)
        return if (quote == QuoteCurrency.Algo) "$formatted $ALGO" else formatted
    }

    // Direction is shown by the arrow, so the percentage itself is unsigned.
    fun percent(value: Double, locale: Locale): String {
        val formatter = NumberFormat.getPercentInstance(locale)
        formatter.minimumFractionDigits = 1
        formatter.maximumFractionDigits = 1
        return formatter.format(Math.abs(value))
    }

    // As the snapshot's algoFormatted.
    fun algo(value: BigDecimal, locale: Locale): String = "${formatCurrency(value, DEFAULT_PRECISION, ALGO, locale)} $ALGO"

    // Asset amounts in a transaction row: up to 6 decimals, as on iOS.
    fun units(value: BigDecimal, locale: Locale): String = decimal(value, 0, 6, locale)

    // How much of the asset one unit of the quote buys: a unit price too.
    fun inverse(price: BigDecimal, quote: QuoteCurrency, unitName: String, locale: Locale): String? {
        if (price.signum() <= 0) return null
        val perUnit = BigDecimal.ONE.divide(price, MathContext.DECIMAL128)
        val amount = formatCurrency(perUnit, UNIT_PRICE_PRECISION, unitName, locale, showSymbol = false, minPrecision = DEFAULT_PRECISION)
        return "1 ${quote.code} = $amount $unitName"
    }

    // Null for a code ISO 4217 doesn't list, and for ISO's non-currencies (XAU and the like report -1).
    fun isoDigits(code: String): Int? =
        runCatching { Currency.getInstance(code) }.getOrNull()?.defaultFractionDigits?.takeIf { it >= 0 }

    private fun decimal(value: BigDecimal, minDigits: Int, maxDigits: Int, locale: Locale): String {
        val formatter = NumberFormat.getNumberInstance(locale)
        formatter.minimumFractionDigits = minDigits
        formatter.maximumFractionDigits = maxDigits
        return formatter.format(value)
    }
}
