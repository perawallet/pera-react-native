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
import SwiftUI
import WidgetKit

struct PriceEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
    /// Live quote from the widget's own fetch; nil falls back to the app's last value.
    let quote: PriceQuote?
    /// The configured asset; ALGO unless the user picked another.
    var asset: AssetEntity = .algo
    var showInverse = true
    /// True when the quote currency is the app's own, so the app-written ALGO
    /// price is a valid fallback.
    var isAppCurrency = true
}

struct PriceProvider: AppIntentTimelineProvider {
    private static let refreshInterval: TimeInterval = 30 * 60

    func placeholder(in context: Context) -> PriceEntry {
        PriceEntry(date: .now, snapshot: nil, quote: nil)
    }

    func snapshot(for configuration: PriceConfigIntent, in context: Context) async -> PriceEntry {
        let snapshot = WidgetSnapshot.current
        // The gallery preview must be instant; it shows the app's last value.
        let quote = context.isPreview ? nil : await quote(snapshot, configuration)
        return entry(.now, snapshot, quote, configuration)
    }

    func timeline(for configuration: PriceConfigIntent, in context: Context) async -> Timeline<PriceEntry> {
        let snapshot = WidgetSnapshot.current
        let quote = await quote(snapshot, configuration)
        let next = Date.now.addingTimeInterval(Self.refreshInterval)
        let entries = minuteEntries(until: next) { entry($0, snapshot, quote, configuration) }
        return Timeline(entries: entries, policy: .after(next))
    }

    private func entry(_ date: Date, _ snapshot: WidgetSnapshot?, _ quote: PriceQuote?, _ configuration: PriceConfigIntent) -> PriceEntry {
        PriceEntry(
            date: date,
            snapshot: snapshot,
            quote: quote,
            asset: configuration.asset ?? .algo,
            showInverse: configuration.showInverse,
            isAppCurrency: configuration.currency?.isAppDefault ?? true
        )
    }

    private func quote(_ snapshot: WidgetSnapshot?, _ configuration: PriceConfigIntent) async -> PriceQuote? {
        guard let feed = snapshot?.priceFeed else { return nil }
        let asset = configuration.asset ?? .algo
        let period = configuration.period.apiValue(appPeriod: snapshot?.portfolioFeed?.period)
        return await PriceFetcher.fetch(feed, assetId: asset.id, quote: quoteCurrency(configuration, asset, feed), period: period)
    }

    // ALGO priced in ALGO says nothing, so that combination falls back to the app's currency.
    private func quoteCurrency(_ configuration: PriceConfigIntent, _ asset: AssetEntity, _ feed: WidgetSnapshot.PriceFeed) -> QuoteCurrency {
        switch configuration.currency.flatMap({ $0.isAppDefault ? nil : $0.id }) {
        case nil: .fiat(feed.currencyCode)
        case "ALGO"? where asset.id == PriceFetcher.nativeAssetId: .fiat(feed.currencyCode)
        case "ALGO"?: .algo
        case let code?: .fiat(code)
        }
    }
}

struct PriceWidgetView: View {
    let entry: PriceEntry
    @Environment(\.widgetFamily) private var family

    private var snapshot: WidgetSnapshot? { entry.snapshot }
    private var isNative: Bool { entry.asset.id == PriceFetcher.nativeAssetId }

    // Read from the snapshot, not the environment: peraEnvironment sets the app's
    // locale for child views only, after these strings are already formatted.
    private var locale: Locale { snapshot?.locale.map(Locale.init(identifier:)) ?? .current }

    var body: some View {
        content
            .peraEnvironment(snapshot)
            .containerBackground(for: .widget) { PeraColor.background }
            .widgetURL(URL(string: "perawallet://app/"))
    }

    @ViewBuilder
    private var content: some View {
        if snapshot == nil && entry.quote == nil {
            PeraPlaceholder()
        } else {
            homeScreen
        }
    }

    private var homeScreen: some View {
        HStack(alignment: .bottom, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                assetHeader
                Spacer(minLength: 0)
                Text(price ?? "—")
                    .font(PeraFont.bold(family == .systemSmall ? 22 : 30))
                    .foregroundStyle(PeraColor.textMain)
                    .lineLimit(1)
                    .minimumScaleFactor(0.4)
                    .contentTransition(.numericText())
                if let changeText {
                    Text(changeText)
                        .font(PeraFont.medium(13))
                        .foregroundStyle(changeColor)
                }
                // A small square has room for the chart or the inverse line,
                // not both; the inverse wins when it's switched on.
                if family == .systemSmall, inverse == nil, let chart {
                    Sparkline(values: chart, color: changeColor)
                        .frame(height: 22)
                        .padding(.vertical, 2)
                }
                if let inverse {
                    Text(inverse)
                        .font(PeraFont.regular(11))
                        .foregroundStyle(PeraColor.textGray)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                if let updated {
                    UpdatedLabel(prefix: snapshot?.string("updated"), date: updated, now: entry.date)
                }
            }
            if family != .systemSmall, let chart {
                Sparkline(values: chart, color: changeColor)
                    .padding(.top, 28)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .peraChrome(network: snapshot?.network)
    }

    // Name, verified badge and, for anything but ALGO, the asset id: a
    // look-alike asset can copy a name but not an id.
    private var assetHeader: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 3) {
                Text(title)
                    .font(PeraFont.medium(family == .systemSmall ? 12 : 13))
                    .foregroundStyle(PeraColor.textGray)
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 10))
                    .foregroundStyle(PeraColor.positive)
            }
            if !isNative {
                Text("ID \(entry.asset.id)")
                    .font(PeraFont.regular(9))
                    .foregroundStyle(PeraColor.textGray)
            }
        }
        .lineLimit(1)
        // Keeps the header clear of the corner badge.
        .padding(.trailing, 24)
    }

    private var unitName: String { entry.quote?.unitName ?? entry.asset.unitName }

    private var title: String {
        isNative ? (snapshot?.string("algoPrice") ?? "ALGO") : unitName
    }

    private var price: String? {
        if let quote = entry.quote {
            return PriceFormat.price(quote.price, quote: quote.quote, locale: locale)
        }
        // The app only writes ALGO in its own currency; anything else has no
        // fallback, and an unverified asset must show nothing.
        return isNative && entry.isAppCurrency ? snapshot?.algoPrice?.formatted : nil
    }

    // ▲/▼ as well as colour: tinted and vibrant rendering modes drop the colour.
    private var changeText: String? {
        guard let change = entry.quote?.change24h else { return nil }
        let arrow = change >= 0 ? "▲" : "▼"
        return "\(arrow) \(PriceFormat.percent(change, locale: locale)) 24h"
    }

    private var changeColor: Color { trendColor(entry.quote?.change24h) }

    private var chart: [Double]? {
        guard let chart = entry.quote?.chart, chart.count > 1 else { return nil }
        return chart
    }

    private var inverse: String? {
        guard entry.showInverse, let quote = entry.quote else { return nil }
        return PriceFormat.inverse(quote.price, quote: quote.quote, unitName: quote.unitName, locale: locale)
    }

    private var updated: Date? {
        entry.quote?.fetchedAt ?? (isNative && entry.isAppCurrency ? snapshot?.algoPrice?.date : nil)
    }
}

struct PriceWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "PeraPriceWidget", intent: PriceConfigIntent.self, provider: PriceProvider()) { entry in
            PriceWidgetView(entry: entry)
        }
        .configurationDisplayName(String(localized: "price.name"))
        .description(String(localized: "price.description"))
        // No lock-screen sizes: they are readable without unlocking, so they wait on a security review.
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

#Preview("Small", as: .systemSmall) {
    PriceWidget()
} timeline: {
    PriceEntry(date: .now, snapshot: .fixtureMainnet, quote: .fixture(change: 0.032))
    PriceEntry(date: .now, snapshot: .fixtureMainnet, quote: .fixtureUsdc, asset: .init(id: "31566704", unitName: "USDC", name: "USDC"))
    PriceEntry(date: .now, snapshot: .fixtureTestnetHidden, quote: .fixture(change: -0.011))
    PriceEntry(date: .now, snapshot: .fixtureMainnet, quote: nil)
}

#Preview("Medium", as: .systemMedium) {
    PriceWidget()
} timeline: {
    PriceEntry(date: .now, snapshot: .fixtureMainnet, quote: .fixture(change: 0.032))
    PriceEntry(date: .now, snapshot: .fixtureMainnet, quote: .fixtureUsdc, asset: .init(id: "31566704", unitName: "USDC", name: "USDC"))
}

