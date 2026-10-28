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
import java.math.MathContext
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

object PriceFormat {
    fun currency(value: BigDecimal, code: String, locale: Locale): String {
        val currency = runCatching { Currency.getInstance(code) }.getOrNull()
            ?: return "${value.toPlainString()} $code"
        val formatter = NumberFormat.getCurrencyInstance(locale)
        formatter.currency = currency
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 4
        return formatter.format(value)
    }

    // ALGO is not an ISO currency, so it cannot go through the currency formatter.
    fun price(value: BigDecimal, quote: QuoteCurrency, locale: Locale): String = when (quote) {
        is QuoteCurrency.Fiat -> currency(value, quote.code, locale)
        QuoteCurrency.Algo -> "${decimal(value, 0, 4, locale)} ALGO"
    }

    // Direction is shown by the arrow, so the percentage itself is unsigned.
    fun percent(value: Double, locale: Locale): String {
        val formatter = NumberFormat.getPercentInstance(locale)
        formatter.minimumFractionDigits = 1
        formatter.maximumFractionDigits = 1
        return formatter.format(Math.abs(value))
    }

    fun algo(value: BigDecimal, locale: Locale): String = "${decimal(value, 2, 2, locale)} ALGO"

    fun inverse(price: BigDecimal, quote: QuoteCurrency, unitName: String, locale: Locale): String? {
        if (price.signum() <= 0) return null
        val perUnit = BigDecimal.ONE.divide(price, MathContext.DECIMAL128)
        return "1 ${quote.code} = ${decimal(perUnit, 0, 2, locale)} $unitName"
    }

    private fun decimal(value: BigDecimal, minDigits: Int, maxDigits: Int, locale: Locale): String {
        val formatter = NumberFormat.getNumberInstance(locale)
        formatter.minimumFractionDigits = minDigits
        formatter.maximumFractionDigits = maxDigits
        return formatter.format(value)
    }
}
