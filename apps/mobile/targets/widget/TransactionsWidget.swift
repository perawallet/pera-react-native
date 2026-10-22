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

/// The rows shown for each size: what fits without truncating labels.
func transactionRowLimit(_ family: WidgetFamily) -> Int {
    family == .systemSmall ? 4 : 3
}

/// The account name when one is picked, otherwise "Last transactions". Falls
/// back to the catalog so the title never renders empty.
func transactionsTitle(_ snapshot: WidgetSnapshot?, accountName: String?) -> String {
    accountName ?? snapshot?.string("recentTransactions") ?? String(localized: "transactions.title")
}

/// Title on top, rows below it. The rows take only the space left and are cut
/// at the bottom, because overflowing content is centred and would push the
/// title off the top.
struct TransactionsPage: View {
    let title: String
    let rows: [TransactionRow]?
    let snapshot: WidgetSnapshot?
    let limit: Int
    let now: Date
    /// Compact rows regardless of size, for a half-width column.
    var isCompact: Bool?
    @Environment(\.widgetFamily) private var family

    var body: some View {
        VStack(alignment: .leading, spacing: family == .systemSmall ? 4 : 10) {
            Text(title)
                .font(PeraFont.medium(family == .systemSmall ? 12 : 13))
                .foregroundStyle(PeraColor.textGray)
                .lineLimit(1)
                // Keeps the title clear of the corner badge.
                .padding(.trailing, 24)
                .fixedSize(horizontal: false, vertical: true)
                .layoutPriority(1)
            TransactionsList(rows: rows, snapshot: snapshot, limit: limit, now: now, compactOverride: isCompact)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .clipped()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct TransactionsList: View {
    let rows: [TransactionRow]?
    let snapshot: WidgetSnapshot?
    let limit: Int
    /// The timeline entry's date, so row times advance with the minute entries.
    let now: Date
    var compactOverride: Bool?
    @Environment(\.widgetFamily) private var family

    // A small square is too narrow for label and amount side by side.
    private var isCompact: Bool { compactOverride ?? (family == .systemSmall) }

    var body: some View {
        if let rows, !rows.isEmpty {
            VStack(alignment: .leading, spacing: isCompact ? 4 : 8) {
                ForEach(rows.prefix(limit)) { row in
                    TransactionRowView(row: row, label: label(row.kind), now: now, isCompact: isCompact)
                }
            }
            // Redacted while the phone is locked (StandBy, Mac desktop).
            .privacySensitive()
        } else {
            // Also when the fetch failed: there is nothing to show either way.
            Text(snapshot?.string("noTransactions") ?? String(localized: "transactions.empty"))
                .font(PeraFont.medium(12))
                .foregroundStyle(PeraColor.textGray)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func label(_ kind: TransactionRow.Kind) -> String {
        let key = switch kind {
        case .send: "txSend"
        case .receive: "txReceive"
        case .swap: "txSwap"
        case .optIn: "txOptIn"
        case .optOut: "txOptOut"
        case .appCall: "txAppCall"
        case .other: "transaction"
        }
        return snapshot?.string(key) ?? ""
    }
}

private struct TransactionRowView: View {
    let row: TransactionRow
    let label: String
    let now: Date
    var isCompact = false
    @Environment(\.locale) private var locale

    var body: some View {
        if isCompact { compact } else { full }
    }

    // Icon, then the amount (or the label when nothing moved) over the time.
    private var compact: some View {
        HStack(spacing: 6) {
            icon(size: 18)
            VStack(alignment: .leading, spacing: 0) {
                Text(row.amount.map(signedAmount) ?? label)
                    .font(PeraFont.medium(11))
                    .foregroundStyle(row.amount == nil ? PeraColor.textMain : amountColor)
                    .minimumScaleFactor(0.6)
                Text(relativeTime)
                    .font(PeraFont.regular(9))
                    .foregroundStyle(PeraColor.textGray)
            }
            .lineLimit(1)
        }
    }

    private func icon(size: CGFloat) -> some View {
        Image(systemName: iconName)
            .font(.system(size: size * 0.45, weight: .semibold))
            .foregroundStyle(PeraColor.textMain)
            .frame(width: size, height: size)
            .background(PeraColor.layer, in: Circle())
    }

    private var full: some View {
        HStack(spacing: 8) {
            icon(size: 24)
            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(PeraFont.medium(12))
                    .foregroundStyle(PeraColor.textMain)
                Text(relativeTime)
                    .font(PeraFont.regular(10))
                    .foregroundStyle(PeraColor.textGray)
            }
            .lineLimit(1)
            Spacer(minLength: 4)
            if let amount = row.amount {
                Text(signedAmount(amount))
                    .font(PeraFont.medium(12))
                    .foregroundStyle(amountColor)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
    }

    private var iconName: String {
        switch row.kind {
        case .send: "arrow.up.right"
        case .receive: "arrow.down.left"
        case .swap: "arrow.left.arrow.right"
        case .optIn: "plus"
        case .optOut: "minus"
        case .appCall: "app"
        case .other: "circle"
        }
    }

    // Direction is carried by the sign and icon as well as colour, since tinted
    // rendering modes drop colour.
    private func signedAmount(_ amount: String) -> String {
        switch row.kind {
        case .send: "−\(amount)"
        case .receive: "+\(amount)"
        default: amount
        }
    }

    private var amountColor: Color {
        switch row.kind {
        case .receive: PeraColor.positive
        default: PeraColor.textMain
        }
    }

    private var relativeTime: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = locale
        formatter.unitsStyle = .short
        formatter.dateTimeStyle = .named
        return formatter.localizedString(for: min(row.date, now), relativeTo: now)
    }
}

struct TransactionsEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
    /// Nil when the fetch failed or there is no feed.
    let rows: [TransactionRow]?
    var accountName: String?
    /// The configured account, which a tap opens; nil for the whole portfolio.
    var accountAddress: String?
}

struct TransactionsProvider: AppIntentTimelineProvider {
    private static let refreshInterval: TimeInterval = 30 * 60

    func placeholder(in context: Context) -> TransactionsEntry {
        TransactionsEntry(date: .now, snapshot: nil, rows: nil)
    }

    func snapshot(for configuration: TransactionsConfigIntent, in context: Context) async -> TransactionsEntry {
        let snapshot = WidgetSnapshot.current
        let rows = context.isPreview ? nil : await recentTransactions(snapshot, account: configuration.account?.address, limit: transactionRowLimit(context.family))
        let name = accountName(snapshot, configuration)
        return TransactionsEntry(
            date: .now, snapshot: snapshot, rows: rows, accountName: name,
            accountAddress: name == nil ? nil : configuration.account?.address
        )
    }

    func timeline(for configuration: TransactionsConfigIntent, in context: Context) async -> Timeline<TransactionsEntry> {
        let snapshot = WidgetSnapshot.current
        let rows = await recentTransactions(snapshot, account: configuration.account?.address, limit: transactionRowLimit(context.family))
        let name = accountName(snapshot, configuration)
        // Only an account the app still shares; a removed one opens the portfolio.
        let address = name == nil ? nil : configuration.account?.address
        let next = Date.now.addingTimeInterval(Self.refreshInterval)
        let entries = minuteEntries(until: next) {
            TransactionsEntry(date: $0, snapshot: snapshot, rows: rows, accountName: name, accountAddress: address)
        }
        return Timeline(entries: entries, policy: .after(next))
    }

    private func accountName(_ snapshot: WidgetSnapshot?, _ configuration: TransactionsConfigIntent) -> String? {
        guard let id = configuration.account?.address else { return nil }
        return snapshot?.portfolioFeed?.accounts.first { $0.address == id }?.name
    }
}

/// Recent rows for one account (when it is still shared) or every account;
/// nil in privacy mode or on a network without a Pera backend.
func recentTransactions(_ snapshot: WidgetSnapshot?, account: String?, limit: Int) async -> [TransactionRow]? {
    guard let portfolio = snapshot?.portfolioFeed, let feed = snapshot?.priceFeed else { return nil }
    let all = portfolio.accounts.map(\.address)
    let addresses = account.flatMap { id in all.contains(id) ? [id] : nil } ?? all
    let locale = snapshot?.locale.map(Locale.init(identifier:)) ?? .current
    return await TransactionsFetcher.fetch(addresses: addresses, limit: limit, locale: locale, feed)
}

struct TransactionsWidgetView: View {
    let entry: TransactionsEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            // No feed means privacy mode (or no backend): nothing to list.
            if entry.snapshot?.portfolioFeed == nil {
                PeraPlaceholder()
            } else {
                TransactionsPage(
                    title: transactionsTitle(entry.snapshot, accountName: entry.accountName),
                    rows: entry.rows,
                    snapshot: entry.snapshot,
                    limit: transactionRowLimit(family),
                    now: entry.date
                )
                .padding(14)
                .peraChrome(network: entry.snapshot?.network)
            }
        }
        .peraEnvironment(entry.snapshot)
        .containerBackground(for: .widget) { PeraColor.background }
        .widgetURL(tapURL)
    }
}

extension TransactionsWidgetView {
    // One account opens its history; the whole portfolio opens the portfolio drawer.
    var tapURL: URL? {
        guard let address = entry.accountAddress else { return URL(string: "perawallet://app/portfolio/") }
        return URL(string: "perawallet://app/account-detail/?address=\(address)&tab=history")
    }
}

struct TransactionsWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "PeraTransactionsWidget", intent: TransactionsConfigIntent.self, provider: TransactionsProvider()) { entry in
            TransactionsWidgetView(entry: entry)
        }
        .configurationDisplayName(String(localized: "transactions.name"))
        .description(String(localized: "transactions.description"))
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

#Preview("Medium", as: .systemMedium) {
    TransactionsWidget()
} timeline: {
    TransactionsEntry(date: .now, snapshot: .fixtureWithFeeds, rows: TransactionRow.fixtures)
    TransactionsEntry(date: .now, snapshot: .fixtureWithFeeds, rows: [])
    TransactionsEntry(date: .now, snapshot: .fixtureTestnetHidden, rows: nil)
}


#Preview("Small", as: .systemSmall) {
    TransactionsWidget()
} timeline: {
    TransactionsEntry(date: .now, snapshot: .fixtureWithFeeds, rows: TransactionRow.fixtures)
}
