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
import XCTest
@testable import WidgetCore

// Expected strings come from the app's own formatCurrency / formatNumber (packages/shared, built dist) run
// under node for en-US and de-DE; the Android widget asserts the same strings.
final class FormattingTests: XCTestCase {
    private let german = Locale(identifier: "de_DE")

    private func d(_ value: String) -> Decimal { Decimal(string: value, locale: Locale(identifier: "en_US_POSIX"))! }

    func testFiatBalancesUseTheCurrencysDecimalsAndRoundHalfUp() {
        let cases: [(String, String, String, String)] = [
            ("1234.5678", "USD", "$ 1,234.57", "$ 1.234,57"),
            ("1234.5678", "EUR", "€ 1,234.57", "€ 1.234,57"),
            ("123456.789", "JPY", "JPY 123,457", "JPY 123.457"),
            ("12.345", "USD", "$ 12.35", "$ 12,35"),
            ("12.355", "GBP", "£ 12.36", "£ 12,36"),
            ("0", "USD", "$ 0.00", "$ 0,00"),
            ("-12.345", "USD", "-$ 12.35", "-$ 12,35"),
            ("1234567.891", "CHF", "CHF 1,234,567.89", "CHF 1.234.567,89"),
            // Three ISO digits, capped at the app's two.
            ("1234.5678", "KWD", "KWD 1,234.57", "KWD 1.234,57"),
            ("12.345", "KWD", "KWD 12.35", "KWD 12,35"),
        ]
        for (value, code, inEnglish, inGerman) in cases {
            XCTAssertEqual(PriceFormat.fiat(d(value), code: code, locale: english), inEnglish)
            XCTAssertEqual(PriceFormat.fiat(d(value), code: code, locale: german), inGerman)
        }
    }

    func testAFiatAmountUnderTheSmallestUnitReadsAsABound() {
        XCTAssertEqual(PriceFormat.fiat(d("0.004"), code: "USD", locale: english), "< $ 0.01")
        XCTAssertEqual(PriceFormat.fiat(d("0.004"), code: "USD", locale: german), "< $ 0,01")
        XCTAssertEqual(PriceFormat.fiat(d("-0.004"), code: "USD", locale: english), "> -$ 0.01")
        XCTAssertEqual(PriceFormat.fiat(d("0.4"), code: "JPY", locale: english), "< JPY 1")
        XCTAssertEqual(PriceFormat.fiat(d("0.004"), code: "KWD", locale: english), "< KWD 0.01")
        XCTAssertEqual(PriceFormat.fiat(d("0.004"), code: "KWD", locale: german), "< KWD 0,01")
    }

    func testUnitPricesKeepSubCentDigits() {
        let cases: [(String, QuoteCurrency, String, String)] = [
            ("0.000012", .fiat("USD"), "$ 0.000012", "$ 0,000012"),
            ("0.1234567", .fiat("USD"), "$ 0.123457", "$ 0,123457"),
            ("5.2", .fiat("EUR"), "€ 5.20", "€ 5,20"),
            ("1234.5", .fiat("USD"), "$ 1,234.50", "$ 1.234,50"),
            ("0.0000001", .fiat("USD"), "$ 0.00", "$ 0,00"),
            ("0.0000125", .fiat("USD"), "$ 0.000013", "$ 0,000013"),
            ("42000.123456789", .fiat("JPY"), "JPY 42,000.123457", "JPY 42.000,123457"),
            ("0.1", .algo, "0.10 ALGO", "0,10 ALGO"),
        ]
        for (value, quote, inEnglish, inGerman) in cases {
            XCTAssertEqual(PriceFormat.price(d(value), quote: quote, locale: english), inEnglish)
            XCTAssertEqual(PriceFormat.price(d(value), quote: quote, locale: german), inGerman)
        }
    }

    func testALGOBalancesHaveTwoDecimals() {
        let cases: [(String, String, String)] = [
            ("12.345", "12.35 ALGO", "12,35 ALGO"),
            ("6500.1", "6,500.10 ALGO", "6.500,10 ALGO"),
            ("0.005", "0.01 ALGO", "0,01 ALGO"),
            ("1234567.899", "1,234,567.90 ALGO", "1.234.567,90 ALGO"),
        ]
        for (value, inEnglish, inGerman) in cases {
            XCTAssertEqual(PriceFormat.algo(d(value), locale: english), inEnglish)
            XCTAssertEqual(PriceFormat.algo(d(value), locale: german), inGerman)
        }
    }

    func testTransactionAmountsKeepUpToSixDecimals() {
        let cases: [(String, String, String)] = [
            ("25", "25", "25"),
            ("1.5", "1.5", "1,5"),
            ("0.000001", "0.000001", "0,000001"),
            ("1234.5678901", "1,234.56789", "1.234,56789"),
            ("0.0000005", "0.000001", "0,000001"),
            ("-12.3456785", "-12.345679", "-12,345679"),
        ]
        for (value, inEnglish, inGerman) in cases {
            XCTAssertEqual(PriceFormat.units(d(value), locale: english), inEnglish)
            XCTAssertEqual(PriceFormat.units(d(value), locale: german), inGerman)
        }
    }

    func testFormatsTheInverseAtUnitPriceDensity() {
        XCTAssertEqual(PriceFormat.inverse(d("0.2"), quote: .fiat("EUR"), unitName: "ALGO", locale: english), "1 EUR = 5.00 ALGO")
        XCTAssertEqual(PriceFormat.inverse(d("100000"), quote: .fiat("USD"), unitName: "goBTC", locale: english), "1 USD = 0.00001 goBTC")
        XCTAssertEqual(PriceFormat.inverse(d("0.2"), quote: .fiat("EUR"), unitName: "ALGO", locale: german), "1 EUR = 5,00 ALGO")
    }

    func testHasNoInverseForAZeroPrice() {
        XCTAssertNil(PriceFormat.inverse(0, quote: .fiat("EUR"), unitName: "ALGO", locale: english))
    }

    // Direction is shown by ▲/▼, so the percentage itself is unsigned.
    func testFormatsPercentagesWithoutASign() {
        XCTAssertEqual(PriceFormat.percent(-0.032, locale: english), "3.2%")
    }

    func testKnowsEachCurrencysDecimals() {
        XCTAssertEqual(PriceFormat.fractionDigits("USD"), 2)
        XCTAssertEqual(PriceFormat.fractionDigits("JPY"), 0)
        XCTAssertEqual(PriceFormat.fractionDigits("KWD"), 3)
    }
}

final class UpdatedTimeTests: XCTestCase {
    private let utc = TimeZone(identifier: "UTC")!
    // 2026-10-27 14:05:00 UTC.
    private let updated = Date(timeIntervalSince1970: 1_793_109_900)

    private func text(now: Date, locale: String) -> String {
        UpdatedTime.text(for: updated, now: now, locale: Locale(identifier: locale), timeZone: utc)
    }

    func testShowsOnlyTheTimeTheSameDay() {
        XCTAssertEqual(text(now: updated.addingTimeInterval(3 * 3600), locale: "en_GB"), "14:05")
    }

    func testFollowsTheLanguagesClock() {
        let now = updated.addingTimeInterval(60)

        XCTAssertEqual(text(now: now, locale: "en_US").replacingOccurrences(of: "\u{202F}", with: " "), "2:05 PM")
        XCTAssertEqual(text(now: now, locale: "de_DE"), "14:05")
    }

    func testAddsTheDayOnceItIsNoLongerToday() {
        let shown = text(now: updated.addingTimeInterval(12 * 3600), locale: "en_GB")

        XCTAssertTrue(shown.contains("27"), shown)
        XCTAssertTrue(shown.contains("Oct"), shown)
        XCTAssertTrue(shown.contains("14:05"), shown)
    }

    func testNeverShowsATimeAheadOfThePhonesClock() {
        XCTAssertEqual(text(now: updated.addingTimeInterval(-120), locale: "en_GB"), "14:03")
    }
}
