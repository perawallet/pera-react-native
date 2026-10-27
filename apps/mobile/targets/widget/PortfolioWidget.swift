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

struct PortfolioEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
    /// Live values from the widget's own fetch; nil falls back to the app's last snapshot.
    let quote: PortfolioQuote?
    var showChart = true
    /// Set when the widget is configured for one account; nil means all accounts.
    var accountName: String?
    /// The configured account's address, which a tap opens; nil means all accounts.
    var accountAddress: String?
    /// 0 = portfolio, 1 = recent transactions (home-screen sizes only).
    var page = 0
    /// Rows for the transactions page; nil when not fetched or the fetch failed.
    var rows: [TransactionRow]?
}

/// One row fewer than the Transactions widget in a small square, where the
/// flip button takes the bottom corner.
func flipPageRowLimit(_ family: WidgetFamily) -> Int {
    family == .systemSmall ? 3 : transactionRowLimit(family)
}

/// How a Portfolio widget switches to its transactions page.
enum PortfolioPager {
    /// The plain Portfolio widget: no transactions page.
    case none
    /// A small flip button in the corner.
    case button
    /// A full-width "Portfolio | Transactions" bar along the bottom.
    case tabs

    var pageKey: String? {
        switch self {
        case .none: nil
        case .button: WidgetPageStore.portfolioButton
        case .tabs: WidgetPageStore.portfolioTabs
        }
    }

    /// The tab bar takes a row's height in both sizes.
    func rowLimit(_ family: WidgetFamily) -> Int {
        self == .tabs ? 2 : flipPageRowLimit(family)
    }
}

/// Only a small square needs two pages; a medium widget shows both side by side.
func isFlippable(_ family: WidgetFamily) -> Bool {
    family == .systemSmall
}

/// Rows in the transactions column of a medium Portfolio & Transactions widget.
let sideBySideRowLimit = 3

struct PortfolioProvider: AppIntentTimelineProvider {
    let pager: PortfolioPager

    private static let refreshInterval: TimeInterval = 30 * 60

    func placeholder(in context: Context) -> PortfolioEntry {
        PortfolioEntry(date: .now, snapshot: nil, quote: nil)
    }

    func snapshot(for configuration: PortfolioConfigIntent, in context: Context) async -> PortfolioEntry {
        let snapshot = WidgetSnapshot.current
        // The gallery preview must be instant; it shows the app's last values.
        if context.isPreview { return entry(.now, snapshot, nil, configuration) }
        let content = await load(snapshot, configuration, context.family)
        return entry(.now, snapshot, content.quote, configuration, page: content.page, rows: content.rows)
    }

    func timeline(for configuration: PortfolioConfigIntent, in context: Context) async -> Timeline<PortfolioEntry> {
        let snapshot = WidgetSnapshot.current
        let content = await load(snapshot, configuration, context.family)
        let next = Date.now.addingTimeInterval(Self.refreshInterval)
        let entries = minuteEntries(until: next) {
            entry($0, snapshot, content.quote, configuration, page: content.page, rows: content.rows)
        }
        return Timeline(entries: entries, policy: .after(next))
    }

    // Fetches only what the current page shows; flipping reloads the widget.
    private func load(
        _ snapshot: WidgetSnapshot?,
        _ configuration: PortfolioConfigIntent,
        _ family: WidgetFamily
    ) async -> (page: Int, quote: PortfolioQuote?, rows: [TransactionRow]?) {
        if pager != .none && family == .systemMedium {
            async let quote = quote(snapshot, configuration)
            async let rows = recentTransactions(
                snapshot,
                account: selectedAccount(snapshot, configuration)?.address,
                limit: sideBySideRowLimit
            )
            return (0, await quote, await rows)
        }
        let page = isFlippable(family) ? pager.pageKey.map(WidgetPageStore.page) ?? 0 : 0
        if page == 1 {
            let account = selectedAccount(snapshot, configuration)?.address
            let rows = await recentTransactions(snapshot, account: account, limit: pager.rowLimit(family))
            return (page, nil, rows)
        }
        return (page, await quote(snapshot, configuration), nil)
    }

    private func entry(
        _ date: Date,
        _ snapshot: WidgetSnapshot?,
        _ quote: PortfolioQuote?,
        _ configuration: PortfolioConfigIntent,
        page: Int = 0,
        rows: [TransactionRow]? = nil
    ) -> PortfolioEntry {
        PortfolioEntry(
            date: date,
            snapshot: snapshot,
            quote: quote,
            showChart: configuration.showChart,
            accountName: selectedAccount(snapshot, configuration)?.name,
            accountAddress: selectedAccount(snapshot, configuration)?.address,
            page: page,
            rows: rows
        )
    }

    // An account the app no longer shares (removed, or privacy mode) falls back to all.
    private func selectedAccount(
        _ snapshot: WidgetSnapshot?,
        _ configuration: PortfolioConfigIntent
    ) -> WidgetSnapshot.PortfolioFeed.Account? {
        guard let id = configuration.account?.address else { return nil }
        return snapshot?.portfolioFeed?.accounts.first { $0.address == id }
    }

    // No feed in privacy mode or on a network without a Pera backend.
    private func quote(_ snapshot: WidgetSnapshot?, _ configuration: PortfolioConfigIntent) async -> PortfolioQuote? {
        guard let portfolio = snapshot?.portfolioFeed, let feed = snapshot?.priceFeed else { return nil }
        let addresses = selectedAccount(snapshot, configuration).map { [$0.address] }
            ?? portfolio.accounts.map(\.address)
        let period = configuration.period.apiValue(appPeriod: portfolio.period)
        return await PortfolioFetcher.fetch(addresses: addresses, period: period, feed)
    }
}

struct PortfolioWidgetView: View {
    let entry: PortfolioEntry
    var pager = PortfolioPager.none
    @Environment(\.widgetFamily) private var family

    private var snapshot: WidgetSnapshot? { entry.snapshot }
    private var portfolio: WidgetSnapshot.Portfolio? { snapshot?.portfolio }
    private var isHidden: Bool { portfolio?.state == "hidden" }

    // Read from the snapshot, not the environment: peraEnvironment sets the app's
    // locale for child views only, after these strings are already formatted.
    private var locale: Locale { snapshot?.locale.map(Locale.init(identifier:)) ?? .current }

    var body: some View {
        content
            .peraEnvironment(snapshot)
            .containerBackground(for: .widget) { PeraColor.background }
            .widgetURL(tapURL)
    }

    // One account opens that account; all accounts open the portfolio drawer.
    private var tapURL: URL? {
        if let address = entry.accountAddress {
            return URL(string: "perawallet://app/account-detail/?address=\(address)")
        }
        return URL(string: "perawallet://app/portfolio/")
    }

    @ViewBuilder
    private var content: some View {
        if snapshot == nil {
            PeraPlaceholder()
        } else if pager != .none && family == .systemMedium && !isHidden {
            sideBySide
        } else if canFlip && pager == .tabs {
            VStack(spacing: 0) {
                homeScreen
                SegmentedPageBar(
                    key: WidgetPageStore.portfolioTabs,
                    tabs: [
                        WidgetPageTab(symbol: "chart.xyaxis.line", label: snapshot?.string("tabPortfolio") ?? ""),
                        WidgetPageTab(symbol: "list.bullet", label: snapshot?.string("tabTransactions") ?? ""),
                    ],
                    selected: entry.page
                )
                .padding([.horizontal, .bottom], 10)
            }
        } else {
            homeScreen
                .overlay(alignment: .bottomTrailing) {
                    if canFlip { flipButton.padding(10) }
                }
        }
    }

    // Privacy mode has nothing to show on the transactions page, so no flipping.
    private var canFlip: Bool { pager != .none && isFlippable(family) && !isHidden }

    /// Room the flip button needs below the content; the tab bar sits outside it.
    private var buttonInset: CGFloat { canFlip && pager == .button ? 14 : 0 }

    @ViewBuilder
    private var homeScreen: some View {
        if canFlip && entry.page == 1 {
            transactionsPage
        } else {
            portfolioPage
        }
    }

    // Portfolio on the left, transactions on the right: medium has room for both.
    private var sideBySide: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(PeraFont.medium(12))
                    .foregroundStyle(PeraColor.textGray)
                    .lineLimit(1)
                Spacer(minLength: 0)
                Text(primary ?? "—")
                    .font(PeraFont.bold(22))
                    .foregroundStyle(PeraColor.textMain)
                    .lineLimit(1)
                    .minimumScaleFactor(0.4)
                    .contentTransition(.numericText())
                    .privacySensitive()
                if let secondary {
                    Text(secondary)
                        .font(PeraFont.regular(12))
                        .foregroundStyle(PeraColor.textGray)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .privacySensitive()
                }
                if let chart {
                    Sparkline(values: chart, color: trendColor(entry.quote?.change))
                        .frame(height: 22)
                        .padding(.vertical, 2)
                        .privacySensitive()
                }
                if let updated {
                    UpdatedLabel(prefix: snapshot?.string("updated"), date: updated, now: entry.date)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            Divider()
            TransactionsPage(
                title: transactionsTitle(snapshot, accountName: nil),
                rows: entry.rows,
                snapshot: snapshot,
                limit: sideBySideRowLimit,
                now: entry.date,
                isCompact: true
            )
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .peraChrome(network: snapshot?.network)
    }

    private var transactionsPage: some View {
        TransactionsPage(
            title: transactionsTitle(snapshot, accountName: entry.accountName),
            rows: entry.rows,
            snapshot: snapshot,
            limit: pager.rowLimit(family),
            now: entry.date
        )
        .padding(14)
        // Leaves room for the flip button in the bottom corner.
        .padding(.bottom, buttonInset)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .peraChrome(network: snapshot?.network)
    }

    // A button, not a swipe: widgets can't scroll or take gestures, only run an intent.
    private var flipButton: some View {
        Button(intent: FlipPortfolioPageIntent()) {
            HStack(spacing: 4) {
                ForEach(0..<2) { index in
                    Circle()
                        .fill(index == entry.page ? PeraColor.textMain : PeraColor.textGray.opacity(0.4))
                        .frame(width: 5, height: 5)
                }
                Image(systemName: entry.page == 0 ? "list.bullet" : "chart.xyaxis.line")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(PeraColor.textMain)
                    .padding(.leading, 2)
            }
            .padding(.horizontal, family == .systemSmall ? 6 : 8)
            .padding(.vertical, family == .systemSmall ? 4 : 5)
            .background(PeraColor.layer, in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private var portfolioPage: some View {
        HStack(alignment: .bottom, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(PeraFont.medium(family == .systemSmall ? 12 : 13))
                    .foregroundStyle(PeraColor.textGray)
                    .lineLimit(1)
                    // Keeps the title clear of the corner badge.
                    .padding(.trailing, 24)
                Spacer(minLength: 0)
                Text(primary ?? "—")
                    .font(PeraFont.bold(family == .systemSmall ? 22 : 30))
                    .foregroundStyle(PeraColor.textMain)
                    .lineLimit(1)
                    .minimumScaleFactor(0.4)
                    .contentTransition(.numericText())
                    // Redacted while the phone is locked (StandBy, Mac desktop).
                    .privacySensitive()
                if let secondary {
                    Text(secondary)
                        .font(PeraFont.regular(family == .systemSmall ? 12 : 14))
                        .foregroundStyle(PeraColor.textGray)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .privacySensitive()
                }
                if family == .systemSmall, let chart {
                    Sparkline(values: chart, color: trendColor(entry.quote?.change))
                        .frame(height: 22)
                        .padding(.vertical, 2)
                        .privacySensitive()
                }
                if let updated {
                    UpdatedLabel(prefix: snapshot?.string("updated"), date: updated, now: entry.date)
                }
            }
            if family != .systemSmall, let chart {
                Sparkline(values: chart, color: trendColor(entry.quote?.change))
                    .padding(.top, 28)
                    .privacySensitive()
            }
        }
        .padding(14)
        // Leaves room for the flip button in the bottom corner.
        .padding(.bottom, buttonInset)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .peraChrome(network: snapshot?.network)
    }

    private var title: String { entry.accountName ?? snapshot?.string("portfolio") ?? "Portfolio" }

    // The snapshot only holds the all-accounts total, so a single-account widget
    // without a live quote shows nothing rather than the wrong number.
    private var fallback: WidgetSnapshot.Portfolio? { entry.accountName == nil ? portfolio : nil }

    // Same order as the app's portfolio header: ALGO first, then "≈" the
    // preferred currency. Privacy mode masks it the same way the app does.
    private var primary: String? {
        if isHidden { return "••••" }
        if let quote = entry.quote { return PriceFormat.algo(quote.algo, locale: locale) }
        return fallback?.algoFormatted
    }

    // Skipped when there is no fiat value, or the preferred currency is ALGO and
    // both lines would match.
    private var secondary: String? {
        guard !isHidden else { return nil }
        let fiat = entry.quote.map { quote in
            quote.fiat.map { PriceFormat.currency($0, code: quote.currencyCode, locale: locale) }
        } ?? fallback?.formatted
        guard let fiat, fiat != portfolio?.algoFormatted else { return nil }
        return "≈ \(fiat)"
    }

    private var chart: [Double]? {
        guard !isHidden, entry.showChart, let chart = entry.quote?.chart, chart.count > 1 else { return nil }
        return chart
    }

    private var updated: Date? {
        guard !isHidden else { return nil }
        if let quote = entry.quote { return quote.fetchedAt }
        return fallback?.asOf.map { Date(timeIntervalSince1970: $0 / 1000) }
    }
}

/// Portfolio only; pairs with the Transactions widget in a Smart Stack.
struct PortfolioWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "PeraPortfolioWidget", intent: PortfolioConfigIntent.self, provider: PortfolioProvider(pager: .none)) { entry in
            PortfolioWidgetView(entry: entry)
        }
        .configurationDisplayName(String(localized: "portfolio.name"))
        .description(String(localized: "portfolio.description"))
        // No lock-screen sizes: they are readable without unlocking, so they wait on a security review.
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

/// Portfolio with a button that flips to recent transactions.
struct PortfolioTransactionsWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "PeraPortfolioTransactionsWidget", intent: PortfolioConfigIntent.self, provider: PortfolioProvider(pager: .button)) { entry in
            PortfolioWidgetView(entry: entry, pager: .button)
        }
        .configurationDisplayName(String(localized: "portfolioTransactions.name"))
        .description(String(localized: "portfolioTransactions.description"))
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

/// The same two pages with a "Portfolio | Transactions" tab bar instead of the
/// corner button, so the team can compare the two.
struct PortfolioTransactionsTabsWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "PeraPortfolioTransactionsTabsWidget", intent: PortfolioConfigIntent.self, provider: PortfolioProvider(pager: .tabs)) { entry in
            PortfolioWidgetView(entry: entry, pager: .tabs)
        }
        .configurationDisplayName(String(localized: "portfolioTransactionsTabs.name"))
        .description(String(localized: "portfolioTransactionsTabs.description"))
        // Small only: a medium one shows both pages side by side, the same as Portfolio & Transactions.
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

#Preview("Small", as: .systemSmall) {
    PortfolioWidget()
} timeline: {
    PortfolioEntry(date: .now, snapshot: .fixtureMainnet, quote: .fixture(change: 0.041))
    PortfolioEntry(date: .now, snapshot: .fixtureTestnetHidden, quote: nil)
    PortfolioEntry(date: .now, snapshot: .fixtureMainnet, quote: nil)
    PortfolioEntry(date: .now, snapshot: nil, quote: nil)
}

#Preview("Medium", as: .systemMedium) {
    PortfolioWidget()
} timeline: {
    PortfolioEntry(date: .now, snapshot: .fixtureMainnet, quote: .fixture(change: 0.041))
    PortfolioEntry(date: .now, snapshot: .fixtureMainnet, quote: .fixture(change: -0.023))
}


#Preview("Medium, side by side", as: .systemMedium) {
    PortfolioTransactionsWidget()
} timeline: {
    PortfolioEntry(date: .now, snapshot: .fixtureWithFeeds, quote: .fixture(change: 0.041), rows: TransactionRow.fixtures)
    PortfolioEntry(date: .now, snapshot: .fixtureWithFeeds, quote: .fixture(change: -0.02), rows: [])
}


#Preview("Small, both pages", as: .systemSmall) {
    PortfolioTransactionsWidget()
} timeline: {
    PortfolioEntry(date: .now, snapshot: .fixtureWithFeeds, quote: .fixture(change: 0.041), page: 0)
    PortfolioEntry(date: .now, snapshot: .fixtureWithFeeds, quote: nil, page: 1, rows: TransactionRow.fixtures)
}


#Preview("Tabs, both pages", as: .systemSmall) {
    PortfolioTransactionsTabsWidget()
} timeline: {
    PortfolioEntry(date: .now, snapshot: .fixtureWithFeeds, quote: .fixture(change: 0.041), page: 0)
    PortfolioEntry(date: .now, snapshot: .fixtureWithFeeds, quote: nil, page: 1, rows: TransactionRow.fixtures)
}
