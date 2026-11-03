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

/// An asset's price, fetched by the widget between app launches.
struct PriceQuote {
    let assetId: String
    let unitName: String
    /// Units of `quote` per 1 whole unit of the asset.
    let price: Decimal
    /// Fractional change over 24h in `quote` (0.032 = +3.2%); nil when a prior value is missing.
    let change24h: Double?
    /// Price over the chosen period, oldest first, in `quote`. Empty when no chart can be built.
    let chart: [Double]
    let quote: QuoteCurrency
    let fetchedAt: Date
}

enum PriceFetcher {
    static let nativeAssetId = "0"

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

        async let asset: AssetPrice? = PeraBackend.get(base, assetPath(assetId), feed)
        async let chart: [ChartPoint]? = PeraBackend.get(base, chartPath(assetId, period), feed)
        let priced: Priced?
        switch quote {
        case .fiat(let code):
            async let rate = usdRate(base, code: code, feed)
            priced = fiat(await asset, rate: await rate, chart: await chart)
        case .algo:
            async let algo: AssetPrice? = PeraBackend.get(base, assetPath(nativeAssetId), feed)
            async let algoChart: [ChartPoint]? = PeraBackend.get(base, chartPath(nativeAssetId, period), feed)
            priced = inAlgo(await asset, algo: await algo, chart: await chart, algoChart: await algoChart)
        }

        guard let asset = await asset,
              isNative || trustedTiers.contains(asset.verification_tier ?? ""),
              let priced
        else { return nil }

        return PriceQuote(
            assetId: assetId,
            unitName: isNative ? "ALGO" : (asset.unit_name ?? asset.name ?? assetId),
            price: priced.price,
            change24h: priced.change,
            chart: priced.chart,
            quote: quote,
            fetchedAt: .now
        )
    }

    private struct Priced {
        let price: Decimal
        let change: Double?
        let chart: [Double]
    }

    // Today's rate is applied to the whole history: the backend has no historical FX series.
    private static func fiat(_ asset: AssetPrice?, rate: Decimal?, chart: [ChartPoint]?) -> Priced? {
        guard let usd = PeraBackend.decimal(asset?.usd_value), let rate else { return nil }
        var change: Double?
        if let previous = PeraBackend.decimal(asset?.usd_value_24_hour_ago), previous != 0 {
            change = double((usd - previous) / previous)
        }
        let factor = double(rate)
        return Priced(price: usd * rate, change: change, chart: (chart ?? []).map { $0.price * factor })
    }

    // Both legs move against USD, so the change and every chart point are ratios of the two.
    private static func inAlgo(_ asset: AssetPrice?, algo: AssetPrice?, chart: [ChartPoint]?, algoChart: [ChartPoint]?) -> Priced? {
        guard let usd = PeraBackend.decimal(asset?.usd_value),
              let algoUsd = PeraBackend.decimal(algo?.usd_value), algoUsd != 0
        else { return nil }
        let price = usd / algoUsd

        var change: Double?
        if let previous = PeraBackend.decimal(asset?.usd_value_24_hour_ago), previous != 0,
           let algoPrevious = PeraBackend.decimal(algo?.usd_value_24_hour_ago), algoPrevious != 0 {
            change = double(price / (previous / algoPrevious) - 1)
        }

        // Points are paired by position; series of different lengths can't be paired, and a wrong chart is
        // worse than none.
        var series: [Double] = []
        if let chart, let algoChart, chart.count == algoChart.count, algoChart.allSatisfy({ $0.price != 0 }) {
            series = zip(chart, algoChart).map { $0.price / $1.price }
        }
        return Priced(price: price, change: change, chart: series)
    }

    private static func assetPath(_ assetId: String) -> String { "v1/public/assets/\(assetId)/" }

    private static func chartPath(_ assetId: String, _ period: String) -> String {
        "v1/assets/price-chart/?asset_id=\(assetId)&period=\(period)"
    }

    private static func double(_ value: Decimal) -> Double { NSDecimalNumber(decimal: value).doubleValue }

    // 1 for USD; otherwise the backend's usd_value is how many units of that
    // currency one USD buys.
    static func usdRate(_ base: URL, code: String, _ feed: WidgetSnapshot.PriceFeed) async -> Decimal? {
        if code == "USD" { return 1 }
        let currency: CurrencyRate? = await PeraBackend.get(base, "v1/currencies/\(code)/", feed)
        return currency.flatMap { PeraBackend.decimal($0.usd_value) }
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
}
