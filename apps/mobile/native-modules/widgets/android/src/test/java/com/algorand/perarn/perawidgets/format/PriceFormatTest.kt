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
import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull

class PriceFormatTest {
    @Test fun algoQuoteHasTheUnit() =
        assertEquals("5.2 ALGO", PriceFormat.price(BigDecimal("5.2"), QuoteCurrency.Algo, Locale.ENGLISH))

    @Test fun inverseIsInTheAssetUnit() =
        assertEquals("1 EUR = 5 ALGO", PriceFormat.inverse(BigDecimal("0.2"), QuoteCurrency.Fiat("EUR"), "ALGO", Locale.ENGLISH))

    @Test fun noInverseForZero() =
        assertNull(PriceFormat.inverse(BigDecimal.ZERO, QuoteCurrency.Fiat("EUR"), "ALGO", Locale.ENGLISH))

    @Test fun percentIsUnsigned() = assertEquals("3.2%", PriceFormat.percent(-0.032, Locale.ENGLISH))

    @Test fun algoUsesTheLocale() =
        assertEquals("6.500,10 ALGO", PriceFormat.algo(BigDecimal("6500.1"), Locale.GERMANY))

    @Test fun fiatKeepsAtLeastTwoAndAtMostFourDecimals() {
        assertEquals("$5.20", PriceFormat.price(BigDecimal("5.2"), QuoteCurrency.Fiat("USD"), Locale.US))
        assertEquals("$0.1235", PriceFormat.currency(BigDecimal("0.12346"), "USD", Locale.US))
    }

    @Test fun roundsHalfEven() =
        assertEquals("\$0.1234", PriceFormat.currency(BigDecimal("0.12345"), "USD", Locale.US))

    @Test fun unknownCurrencyFallsBackToPlainDigits() =
        assertEquals("1000 XXQ", PriceFormat.currency(BigDecimal("1E+3"), "XXQ", Locale.US))
}
