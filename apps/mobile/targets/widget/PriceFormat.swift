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
import Foundation

/// What a price is quoted in: a fiat currency code, or ALGO.
enum QuoteCurrency: Equatable {
    case fiat(String)
    case algo

    var code: String {
        switch self {
        case .fiat(let code): code
        case .algo: "ALGO"
        }
    }
}

/// Ports of the app's formatNumber / formatCurrency (`@perawallet/wallet-core-shared`), so a figure the
/// widget formats reads exactly like the one the app wrote into the snapshot. FormattingTests holds
/// strings generated from the TypeScript functions; keep both in step.
enum PeraNumberFormat {
    // formatCurrency maps only these to a symbol; every other code is written out.
    private static let symbols = ["USD": "$", "EUR": "€", "GBP": "£"]

    /// formatNumber: rounds half-up to `precision` decimals, trims trailing zeros down to
    /// `minPrecision` (default `precision`), groups the integer part in `locale`.
    static func number(_ value: Decimal, precision: Int, minPrecision: Int? = nil, locale: Locale) -> String {
        let parts = split(value, precision: precision, minPrecision: minPrecision, locale: locale)
        return parts.sign + parts.integer + parts.fraction
    }

    /// formatCurrency with its symbol: "$ 1,234.57", "JPY 123,457"; no symbol for ALGO.
    static func currency(_ value: Decimal, precision: Int, code: String, minPrecision: Int? = nil, locale: Locale) -> String {
        let parts = split(value, precision: precision, minPrecision: minPrecision, locale: locale)
        let symbol = code == "ALGO" ? "" : "\(symbols[code] ?? code) "
        return parts.sign + symbol + parts.integer + parts.fraction
    }

    /// `fraction` carries the locale's decimal separator, or is empty when no digit is left.
    private static func split(
        _ value: Decimal, precision: Int, minPrecision: Int?, locale: Locale
    ) -> (sign: String, integer: String, fraction: String) {
        let places = max(precision, minPrecision ?? 0)
        var source = value
        var rounded = Decimal()
        // .plain rounds a tie away from zero, which is decimal.js's ROUND_HALF_UP.
        NSDecimalRound(&rounded, &source, places, .plain)

        let isNegative = rounded < 0
        let magnitude = isNegative ? -rounded : rounded
        let digits = magnitude.description.split(separator: ".", omittingEmptySubsequences: false)
        let integerDigits = digits.first.map(String.init) ?? "0"
        var fractionDigits = digits.count > 1 ? String(digits[1]) : ""
        if fractionDigits.count < places {
            fractionDigits += String(repeating: "0", count: places - fractionDigits.count)
        }
        let keep = minPrecision ?? precision
        while fractionDigits.count > keep, fractionDigits.hasSuffix("0") {
            fractionDigits.removeLast()
        }

        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        let integer = formatter.string(from: NSDecimalNumber(string: integerDigits)) ?? integerDigits
        let separator = formatter.decimalSeparator ?? "."
        return (isNegative ? "-" : "", integer, fractionDigits.isEmpty ? "" : separator + fractionDigits)
    }
}

enum PriceFormat {
    // The app's ASSET_MAX_PRECISION and DEFAULT_PRECISION: a unit price trims 6 decimals down to 2, fiat
    // or not, so a cheap token's sub-cent digits survive.
    private static let unitPricePrecision = 6
    private static let unitPriceMinPrecision = 2

    // The app's DEFAULT_PRECISION: no fiat figure shows more than 2 decimals, even for a 3-digit currency.
    private static let maxFiatDigits = 2

    /// A fiat balance at the currency's own decimals capped at 2 (JPY none, KWD 2); a non-zero amount
    /// under the smallest shown unit reads "< $ 0.01", as the app's fiat floor does.
    static func fiat(_ value: Decimal, code: String, locale: Locale) -> String {
        let digits = min(fractionDigits(code), maxFiatDigits)
        let floor = Decimal(sign: .plus, exponent: -digits, significand: 1)
        if value != 0 && abs(value) < floor {
            let bound = value < 0 ? -floor : floor
            let shown = PeraNumberFormat.currency(bound, precision: digits, code: code, minPrecision: digits, locale: locale)
            return (value < 0 ? "> " : "< ") + shown
        }
        return PeraNumberFormat.currency(value, precision: digits, code: code, minPrecision: digits, locale: locale)
    }

    /// The price of one unit of an asset in its quote.
    static func price(_ value: Decimal, quote: QuoteCurrency, locale: Locale) -> String {
        let formatted = PeraNumberFormat.currency(
            value, precision: unitPricePrecision, code: quote.code, minPrecision: unitPriceMinPrecision, locale: locale
        )
        // formatCurrency omits the symbol for ALGO, so the unit is named, as in the app's snapshot.
        return quote == .algo ? "\(formatted) ALGO" : formatted
    }

    /// An ALGO balance, as the snapshot writes it: 2 decimals.
    static func algo(_ value: Decimal, locale: Locale) -> String {
        "\(PeraNumberFormat.currency(value, precision: 2, code: "ALGO", locale: locale)) ALGO"
    }

    /// An asset amount in a transaction row: up to 6 decimals, trailing zeros dropped.
    static func units(_ value: Decimal, locale: Locale) -> String {
        PeraNumberFormat.number(value, precision: 6, minPrecision: 0, locale: locale)
    }

    static func percent(_ value: Double, locale: Locale) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .percent
        formatter.locale = locale
        formatter.roundingMode = .halfUp
        formatter.minimumFractionDigits = 1
        formatter.maximumFractionDigits = 1
        return formatter.string(from: NSNumber(value: abs(value))) ?? ""
    }

    /// How much of the asset one unit of the quote buys, e.g. "1 EUR = 5.42 ALGO", at unit-price density.
    static func inverse(_ price: Decimal, quote: QuoteCurrency, unitName: String, locale: Locale) -> String? {
        guard price > 0 else { return nil }
        let amount = PeraNumberFormat.number(
            1 / price, precision: unitPricePrecision, minPrecision: unitPriceMinPrecision, locale: locale
        )
        return "1 \(quote.code) = \(amount) \(unitName)"
    }

    /// ISO 4217 minor units; 2 for a code ICU doesn't know.
    static func fractionDigits(_ code: String) -> Int {
        var digits: Int32 = 0
        var increment: Double = 0
        guard CFNumberFormatterGetDecimalInfoForCurrencyCode(code as CFString, &digits, &increment), digits >= 0 else {
            return 2
        }
        return Int(digits)
    }
}
