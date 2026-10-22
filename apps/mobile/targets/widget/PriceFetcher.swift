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

/// An asset's price, fetched by the widget between app launches.
struct PriceQuote {
    let assetId: String
    let unitName: String
    /// Units of `quote` per 1 whole unit of the asset.
    let price: Decimal
    /// Fractional change over 24h (0.032 = +3.2%); nil when the backend has no prior value.
    let change24h: Double?
    /// Price over the chosen period, oldest first, in `quote`. Empty when the chart call fails.
    let chart: [Double]
    let quote: QuoteCurrency
    let fetchedAt: Date
}

enum PriceFetcher {
    static let nativeAssetId = "0"

    // WidgetKit gives a timeline request only a few seconds; give up early and
    // fall back to the price the app last wrote.
    private static let timeout: TimeInterval = 8

    // The picker only offers verified assets, but a tier can be downgraded after
    // the user picked one, so every fetch re-checks it.
    private static let trustedTiers: Set<String> = ["verified", "trusted"]

    /// Nil on any failure, and for an asset that is no longer verified.
    /// `period` is the backend value: one-day | one-week | one-month | one-year.
    static func fetch(
        _ feed: WidgetSnapshot.PriceFeed,
        assetId: String,
        quote: QuoteCurrency,
        period: String
    ) async -> PriceQuote? {
        guard let base = URL(string: feed.backendUrl) else { return nil }
        let isNative = assetId == nativeAssetId

        async let asset: AssetPrice? = get(base, "v1/public/assets/\(assetId)/", feed)
        async let factor: Decimal? = usdFactor(base, quote, feed)
        async let chart: [ChartPoint]? = get(base, "v1/assets/price-chart/?asset_id=\(assetId)&period=\(period)", feed)

        guard let asset = await asset,
              isNative || trustedTiers.contains(asset.verification_tier ?? ""),
              let usd = decimal(asset.usd_value),
              let factor = await factor
        else { return nil }

        var change: Double?
        if let previous = decimal(asset.usd_value_24_hour_ago), previous != 0 {
            change = NSDecimalNumber(decimal: (usd - previous) / previous).doubleValue
        }
        let factorValue = NSDecimalNumber(decimal: factor).doubleValue
        let series = (await chart ?? []).map { $0.price * factorValue }

        return PriceQuote(
            assetId: assetId,
            unitName: isNative ? "ALGO" : (asset.unit_name ?? asset.name ?? assetId),
            price: usd * factor,
            change24h: change,
            chart: series,
            quote: quote,
            fetchedAt: .now
        )
    }

    /// Multiplier from USD into `quote`.
    private static func usdFactor(_ base: URL, _ quote: QuoteCurrency, _ feed: WidgetSnapshot.PriceFeed) async -> Decimal? {
        switch quote {
        case .fiat(let code):
            return await usdRate(base, code: code, feed)
        case .algo:
            let algo: AssetPrice? = await get(base, "v1/public/assets/\(nativeAssetId)/", feed)
            guard let algoUsd = decimal(algo?.usd_value), algoUsd != 0 else { return nil }
            return 1 / algoUsd
        }
    }

    // 1 for USD; otherwise the backend's usd_value is how many units of that
    // currency one USD buys.
    static func usdRate(_ base: URL, code: String, _ feed: WidgetSnapshot.PriceFeed) async -> Decimal? {
        if code == "USD" { return 1 }
        let currency: CurrencyRate? = await get(base, "v1/currencies/\(code)/", feed)
        return currency.flatMap { decimal($0.usd_value) }
    }

    static func get<T: Decodable>(_ base: URL, _ path: String, _ feed: WidgetSnapshot.PriceFeed) async -> T? {
        await send(base, path, apiKey: feed.apiKey, body: nil)
    }

    /// The inbox is a POST: the addresses travel in the body.
    static func post<T: Decodable, Body: Encodable>(_ base: URL, _ path: String, apiKey: String, body: Body) async -> T? {
        guard let data = try? JSONEncoder().encode(body) else { return nil }
        return await send(base, path, apiKey: apiKey, body: data)
    }

    static func send<T: Decodable>(_ base: URL, _ path: String, apiKey: String, body: Data?) async -> T? {
        guard let url = URL(string: path, relativeTo: base.appendingPathComponent("")) else { return nil }
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !apiKey.isEmpty {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }
        if let body {
            request.httpMethod = "POST"
            request.httpBody = body
        }
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200
        else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    // Amounts arrive as strings (or occasionally numbers); Decimal avoids float drift.
    static func decimal(_ value: FlexibleNumber?) -> Decimal? {
        switch value {
        case .string(let string): Decimal(string: string, locale: Locale(identifier: "en_US_POSIX"))
        case .number(let number): Decimal(number)
        case nil: nil
        }
    }

    private struct AssetPrice: Decodable {
        let name: String?
        let unit_name: String?
        let verification_tier: String?
        let usd_value: FlexibleNumber?
        let usd_value_24_hour_ago: FlexibleNumber?
    }

    private struct CurrencyRate: Decodable {
        let usd_value: FlexibleNumber?
    }

    private struct ChartPoint: Decodable {
        let price: Double
    }

    enum FlexibleNumber: Decodable {
        case string(String)
        case number(Double)

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let string = try? container.decode(String.self) {
                self = .string(string)
            } else {
                self = .number(try container.decode(Double.self))
            }
        }

        var stringValue: String {
            switch self {
            case .string(let string): string
            case .number(let number): String(format: "%.0f", number)
            }
        }
    }
}

enum PriceFormat {
    static func currency(_ value: Decimal, code: String, locale: Locale) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = code
        formatter.locale = locale
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 4
        return formatter.string(from: value as NSDecimalNumber) ?? "\(value) \(code)"
    }

    /// A price in its quote: currency formatting for fiat, "0.1234 ALGO" for ALGO
    /// (not an ISO currency, so NumberFormatter can't render it as one).
    static func price(_ value: Decimal, quote: QuoteCurrency, locale: Locale) -> String {
        switch quote {
        case .fiat(let code): currency(value, code: code, locale: locale)
        case .algo: "\(decimal(value, maxDigits: 4, locale: locale)) ALGO"
        }
    }

    static func percent(_ value: Double, locale: Locale) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .percent
        formatter.locale = locale
        formatter.minimumFractionDigits = 1
        formatter.maximumFractionDigits = 1
        return formatter.string(from: NSNumber(value: abs(value))) ?? ""
    }

    static func algo(_ value: Decimal, locale: Locale) -> String {
        "\(decimal(value, minDigits: 2, maxDigits: 2, locale: locale)) ALGO"
    }

    static func decimal(_ value: Decimal, minDigits: Int = 0, maxDigits: Int, locale: Locale) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = locale
        formatter.minimumFractionDigits = minDigits
        formatter.maximumFractionDigits = maxDigits
        return formatter.string(from: value as NSDecimalNumber) ?? "\(value)"
    }

    /// How much of the asset one unit of the quote buys, e.g. "1 EUR = 5.42 ALGO".
    static func inverse(_ price: Decimal, quote: QuoteCurrency, unitName: String, locale: Locale) -> String? {
        guard price > 0 else { return nil }
        return "1 \(quote.code) = \(decimal(1 / price, maxDigits: 2, locale: locale)) \(unitName)"
    }
}
