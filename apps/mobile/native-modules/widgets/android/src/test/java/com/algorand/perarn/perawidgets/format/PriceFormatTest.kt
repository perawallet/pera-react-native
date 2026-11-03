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
import java.util.Locale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// Expected strings come from running wallet-core-shared's formatCurrency (packages/shared/dist) under node with the
// same inputs, composed the way CurrencyAmount composes it; a change on either side shows up here.
class PriceFormatTest {
    private fun check(expected: String, actual: String?) = assertEquals(expected, actual)

    @Test fun matchesTheAppsFormatterInEnglishAndGerman() {
        check("$ 1,234.50", PriceFormat.formatCurrency(BigDecimal("1234.5"), 2, "USD", Locale.US, showSymbol = true, minPrecision = 2))
        check("€ 1,234,567.89", PriceFormat.formatCurrency(BigDecimal("1234567.891"), 2, "EUR", Locale.US, showSymbol = true, minPrecision = 2))
        check("£ 0.13", PriceFormat.formatCurrency(BigDecimal("0.125"), 2, "GBP", Locale.US, showSymbol = true, minPrecision = 2))
        check("JPY 1,235", PriceFormat.formatCurrency(BigDecimal("1234.5"), 0, "JPY", Locale.US, showSymbol = true, minPrecision = 0))
        check("TRY 12.35", PriceFormat.formatCurrency(BigDecimal("12.345"), 2, "TRY", Locale.US, showSymbol = true, minPrecision = 2))
        check("$ 0.0921", PriceFormat.formatCurrency(BigDecimal("0.0921"), 6, "USD", Locale.US, showSymbol = true, minPrecision = 2))
        check("$ 0.000012", PriceFormat.formatCurrency(BigDecimal("0.000012345"), 6, "USD", Locale.US, showSymbol = true, minPrecision = 2))
        check("€ 1.50", PriceFormat.formatCurrency(BigDecimal("1.5"), 6, "EUR", Locale.US, showSymbol = true, minPrecision = 2))
        check("$ 0.00", PriceFormat.formatCurrency(BigDecimal("0.0000004"), 6, "USD", Locale.US, showSymbol = true, minPrecision = 2))
        check("2.50", PriceFormat.formatCurrency(BigDecimal("2.5"), 6, "ALGO", Locale.US, showSymbol = true, minPrecision = 2))
        check("1,234.57", PriceFormat.formatCurrency(BigDecimal("1234.567"), 2, "ALGO", Locale.US, showSymbol = true, minPrecision = null))
        check("XYZ 0.004123", PriceFormat.formatCurrency(BigDecimal("0.004123456789"), 6, "XYZ", Locale.US, showSymbol = true, minPrecision = 2))
        check("10.857143", PriceFormat.formatCurrency(BigDecimal("10.8571428571"), 6, "USDC", Locale.US, showSymbol = false, minPrecision = 2))
        check("$ 1,000.00", PriceFormat.formatCurrency(BigDecimal("1000"), 2, "USD", Locale.US, showSymbol = true, minPrecision = null))
        check("$ 1,500.50", PriceFormat.currency(BigDecimal("1500.5"), "USD", Locale.US))
        check("< $ 0.01", PriceFormat.currency(BigDecimal("0.004"), "USD", Locale.US))
        check("€ 0.01", PriceFormat.currency(BigDecimal("0.01"), "EUR", Locale.US))
        check("JPY 1,235", PriceFormat.currency(BigDecimal("1234.5"), "JPY", Locale.US))
        check("< JPY 1", PriceFormat.currency(BigDecimal("0.4"), "JPY", Locale.US))
        check("$ 0.00", PriceFormat.currency(BigDecimal("0"), "USD", Locale.US))
        check("BRL 100,000.00", PriceFormat.currency(BigDecimal("99999.995"), "BRL", Locale.US))
        check("XYZ 0.004123", PriceFormat.currency(BigDecimal("0.004123456789"), "XYZ", Locale.US))
        check("$ 0.2341", PriceFormat.price(BigDecimal("0.2341"), QuoteCurrency.Fiat("USD"), Locale.US))
        check("€ 0.000012", PriceFormat.price(BigDecimal("0.000012345"), QuoteCurrency.Fiat("EUR"), Locale.US))
        check("JPY 1.50", PriceFormat.price(BigDecimal("1.5"), QuoteCurrency.Fiat("JPY"), Locale.US))
        check("5.20 ALGO", PriceFormat.price(BigDecimal("5.2"), QuoteCurrency.Algo, Locale.US))
        check("$ 123,456.789123", PriceFormat.price(BigDecimal("123456.7891234"), QuoteCurrency.Fiat("USD"), Locale.US))
        check("1 USD = 4.271679 ALGO", PriceFormat.inverse(BigDecimal("0.2341"), QuoteCurrency.Fiat("USD"), "ALGO", Locale.US))
        check("1 EUR = 5.00 ALGO", PriceFormat.inverse(BigDecimal("0.2"), QuoteCurrency.Fiat("EUR"), "ALGO", Locale.US))
        check("1 ALGO = 0.25 USDC", PriceFormat.inverse(BigDecimal("4"), QuoteCurrency.Algo, "USDC", Locale.US))
        check("6,500.10 ALGO", PriceFormat.algo(BigDecimal("6500.1"), Locale.US))
        check("0.01 ALGO", PriceFormat.algo(BigDecimal("0.005"), Locale.US))
        check("1,234,567.89 ALGO", PriceFormat.algo(BigDecimal("1234567.891"), Locale.US))
        check("$ 1.234,50", PriceFormat.formatCurrency(BigDecimal("1234.5"), 2, "USD", Locale.GERMANY, showSymbol = true, minPrecision = 2))
        check("€ 1.234.567,89", PriceFormat.formatCurrency(BigDecimal("1234567.891"), 2, "EUR", Locale.GERMANY, showSymbol = true, minPrecision = 2))
        check("£ 0,13", PriceFormat.formatCurrency(BigDecimal("0.125"), 2, "GBP", Locale.GERMANY, showSymbol = true, minPrecision = 2))
        check("JPY 1.235", PriceFormat.formatCurrency(BigDecimal("1234.5"), 0, "JPY", Locale.GERMANY, showSymbol = true, minPrecision = 0))
        check("TRY 12,35", PriceFormat.formatCurrency(BigDecimal("12.345"), 2, "TRY", Locale.GERMANY, showSymbol = true, minPrecision = 2))
        check("$ 0,0921", PriceFormat.formatCurrency(BigDecimal("0.0921"), 6, "USD", Locale.GERMANY, showSymbol = true, minPrecision = 2))
        check("$ 0,000012", PriceFormat.formatCurrency(BigDecimal("0.000012345"), 6, "USD", Locale.GERMANY, showSymbol = true, minPrecision = 2))
        check("€ 1,50", PriceFormat.formatCurrency(BigDecimal("1.5"), 6, "EUR", Locale.GERMANY, showSymbol = true, minPrecision = 2))
        check("$ 0,00", PriceFormat.formatCurrency(BigDecimal("0.0000004"), 6, "USD", Locale.GERMANY, showSymbol = true, minPrecision = 2))
        check("2,50", PriceFormat.formatCurrency(BigDecimal("2.5"), 6, "ALGO", Locale.GERMANY, showSymbol = true, minPrecision = 2))
        check("1.234,57", PriceFormat.formatCurrency(BigDecimal("1234.567"), 2, "ALGO", Locale.GERMANY, showSymbol = true, minPrecision = null))
        check("XYZ 0,004123", PriceFormat.formatCurrency(BigDecimal("0.004123456789"), 6, "XYZ", Locale.GERMANY, showSymbol = true, minPrecision = 2))
        check("10,857143", PriceFormat.formatCurrency(BigDecimal("10.8571428571"), 6, "USDC", Locale.GERMANY, showSymbol = false, minPrecision = 2))
        check("$ 1.000,00", PriceFormat.formatCurrency(BigDecimal("1000"), 2, "USD", Locale.GERMANY, showSymbol = true, minPrecision = null))
        check("$ 1.500,50", PriceFormat.currency(BigDecimal("1500.5"), "USD", Locale.GERMANY))
        check("< $ 0,01", PriceFormat.currency(BigDecimal("0.004"), "USD", Locale.GERMANY))
        check("€ 0,01", PriceFormat.currency(BigDecimal("0.01"), "EUR", Locale.GERMANY))
        check("JPY 1.235", PriceFormat.currency(BigDecimal("1234.5"), "JPY", Locale.GERMANY))
        check("< JPY 1", PriceFormat.currency(BigDecimal("0.4"), "JPY", Locale.GERMANY))
        check("$ 0,00", PriceFormat.currency(BigDecimal("0"), "USD", Locale.GERMANY))
        check("BRL 100.000,00", PriceFormat.currency(BigDecimal("99999.995"), "BRL", Locale.GERMANY))
        check("XYZ 0,004123", PriceFormat.currency(BigDecimal("0.004123456789"), "XYZ", Locale.GERMANY))
        check("$ 0,2341", PriceFormat.price(BigDecimal("0.2341"), QuoteCurrency.Fiat("USD"), Locale.GERMANY))
        check("€ 0,000012", PriceFormat.price(BigDecimal("0.000012345"), QuoteCurrency.Fiat("EUR"), Locale.GERMANY))
        check("JPY 1,50", PriceFormat.price(BigDecimal("1.5"), QuoteCurrency.Fiat("JPY"), Locale.GERMANY))
        check("5,20 ALGO", PriceFormat.price(BigDecimal("5.2"), QuoteCurrency.Algo, Locale.GERMANY))
        check("$ 123.456,789123", PriceFormat.price(BigDecimal("123456.7891234"), QuoteCurrency.Fiat("USD"), Locale.GERMANY))
        check("1 USD = 4,271679 ALGO", PriceFormat.inverse(BigDecimal("0.2341"), QuoteCurrency.Fiat("USD"), "ALGO", Locale.GERMANY))
        check("1 EUR = 5,00 ALGO", PriceFormat.inverse(BigDecimal("0.2"), QuoteCurrency.Fiat("EUR"), "ALGO", Locale.GERMANY))
        check("1 ALGO = 0,25 USDC", PriceFormat.inverse(BigDecimal("4"), QuoteCurrency.Algo, "USDC", Locale.GERMANY))
        check("6.500,10 ALGO", PriceFormat.algo(BigDecimal("6500.1"), Locale.GERMANY))
        check("0,01 ALGO", PriceFormat.algo(BigDecimal("0.005"), Locale.GERMANY))
        check("1.234.567,89 ALGO", PriceFormat.algo(BigDecimal("1234567.891"), Locale.GERMANY))
    }

    @Test fun fiatDigitsAreCappedAtTwo() {
        check("KWD 1.24", PriceFormat.currency(BigDecimal("1.2355"), "KWD", Locale.US))
        check("< KWD 0.01", PriceFormat.currency(BigDecimal("0.004"), "KWD", Locale.US))
    }

    @Test fun noInverseForZero() =
        assertNull(PriceFormat.inverse(BigDecimal.ZERO, QuoteCurrency.Fiat("EUR"), "ALGO", Locale.ENGLISH))

    @Test fun percentIsUnsigned() = assertEquals("3.2%", PriceFormat.percent(-0.032, Locale.ENGLISH))

    @Test fun isoDigitsComeFromTheCurrency() {
        assertEquals(2, PriceFormat.isoDigits("USD"))
        assertEquals(0, PriceFormat.isoDigits("JPY"))
        assertEquals(3, PriceFormat.isoDigits("KWD"))
        assertNull(PriceFormat.isoDigits("ALGO"))
        assertNull(PriceFormat.isoDigits("XAU"))
    }
}
