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

final class FormattingTests: XCTestCase {
    func testFormatsAnALGOQuoteWithTheUnit() {
        XCTAssertEqual(PriceFormat.price(Decimal(string: "5.2")!, quote: .algo, locale: english), "5.2 ALGO")
    }

    func testFormatsTheInverseInTheAssetUnit() {
        XCTAssertEqual(
            PriceFormat.inverse(Decimal(string: "0.2")!, quote: .fiat("EUR"), unitName: "ALGO", locale: english),
            "1 EUR = 5 ALGO"
        )
    }

    func testHasNoInverseForAZeroPrice() {
        XCTAssertNil(PriceFormat.inverse(0, quote: .fiat("EUR"), unitName: "ALGO", locale: english))
    }

    // Direction is shown by ▲/▼, so the percentage itself is unsigned.
    func testFormatsPercentagesWithoutASign() {
        XCTAssertEqual(PriceFormat.percent(-0.032, locale: english), "3.2%")
    }

    func testFormatsALGOWithTwoDecimalsInTheLocale() {
        XCTAssertEqual(PriceFormat.algo(Decimal(string: "6500.1")!, locale: Locale(identifier: "de_DE")), "6.500,10 ALGO")
    }
}

final class RelativeTimeTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 10_000)

    func testReadsAsNowUnderAMinute() {
        XCTAssertEqual(RelativeTime.shownDate(for: now.addingTimeInterval(-59), now: now), now)
    }

    func testFloorsToWholeMinutes() {
        XCTAssertEqual(RelativeTime.shownDate(for: now.addingTimeInterval(-150), now: now), now.addingTimeInterval(-120))
    }

    func testReadsAFutureDateAsNow() {
        XCTAssertEqual(RelativeTime.shownDate(for: now.addingTimeInterval(30), now: now), now)
    }
}
