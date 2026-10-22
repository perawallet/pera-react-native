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

/// Portfolio value and history fetched by the widget between app launches.
struct PortfolioQuote {
    /// Display units of ALGO.
    let algo: Decimal
    /// Display units of `currencyCode`; nil when no rate is known.
    let fiat: Decimal?
    let currencyCode: String
    /// ALGO value over the chosen period, oldest first.
    let chart: [Double]
    /// Fractional change across `chart`; nil when it starts at zero.
    let change: Double?
    let fetchedAt: Date
}

enum PortfolioFetcher {
    // The same endpoint as the app's home chart: its last point is the current
    // total, so one call gives both the amounts and the chart.
    /// `period` is the backend value: one-day | one-week | one-month | one-year.
    static func fetch(
        addresses: [String],
        period: String,
        _ feed: WidgetSnapshot.PriceFeed
    ) async -> PortfolioQuote? {
        guard let base = URL(string: feed.backendUrl), !addresses.isEmpty else { return nil }

        var components = URLComponents()
        components.path = "v1/wallet/wealth/"
        components.queryItems = [
            // The app's HTTP client joins arrays with commas; the backend expects that.
            URLQueryItem(name: "account_addresses", value: addresses.joined(separator: ",")),
            URLQueryItem(name: "period", value: period),
        ]
        guard let path = components.string else { return nil }

        async let history: Wealth? = PriceFetcher.get(base, path, feed)
        async let rate: Decimal? = PriceFetcher.usdRate(base, code: feed.currencyCode, feed)

        guard let points = await history?.results, let last = points.last,
              let algo = PriceFetcher.decimal(last.algo_value)
        else { return nil }

        var fiat: Decimal?
        let rateValue = await rate
        if let usd = PriceFetcher.decimal(last.usd_value), let rateValue {
            fiat = usd * rateValue
        }
        let chart = points.compactMap { PriceFetcher.decimal($0.algo_value) }
            .map { NSDecimalNumber(decimal: $0).doubleValue }
        var change: Double?
        if let first = chart.first, let end = chart.last, first != 0 {
            change = (end - first) / first
        }

        return PortfolioQuote(
            algo: algo,
            fiat: fiat,
            currencyCode: feed.currencyCode,
            chart: chart,
            change: change,
            fetchedAt: .now
        )
    }

    private struct Wealth: Decodable {
        let results: [Point]
    }

    private struct Point: Decodable {
        let usd_value: PriceFetcher.FlexibleNumber?
        let algo_value: PriceFetcher.FlexibleNumber?
    }
}
