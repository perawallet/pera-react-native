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

struct InboxEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
    /// Nil when not fetched for this widget, or the fetch failed.
    var inbox: InboxSummary?
    var notifications: [NotificationRow]?
    /// 0 = inbox, 1 = notifications; only the tabs widget flips.
    var page = 0
}

enum InboxLinks {
    static let inbox = URL(string: "perawallet://app/inbox/")
    static let notifications = URL(string: "perawallet://app/notifications/")

    static func open(_ item: InboxItem) -> URL? {
        switch item.kind {
        case .sign:
            item.signRequestId.flatMap { URL(string: "perawallet://app/sign-request/?signRequestId=\($0)") } ?? inbox
        case .assets:
            URL(string: "perawallet://app/asset-inbox/?address=\(item.address)")
        case .invite:
            inbox
        }
    }
}

/// What a widget fetches; the tabs widget fetches only the page it shows.
enum InboxContent {
    case inbox
    case notifications
    case tabs

    static let notificationLimit = 3
}

struct InboxProvider: TimelineProvider {
    let content: InboxContent

    private static let refreshInterval: TimeInterval = 30 * 60

    func placeholder(in context: Context) -> InboxEntry {
        InboxEntry(date: .now, snapshot: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (InboxEntry) -> Void) {
        Task { completion(await load(at: .now, isPreview: context.isPreview, family: context.family)) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<InboxEntry>) -> Void) {
        Task {
            let first = await load(at: .now, isPreview: false, family: context.family)
            let next = Date.now.addingTimeInterval(Self.refreshInterval)
            // One entry per minute so row times and "Updated" advance between fetches.
            let entries = minuteEntries(until: next) { date in
                InboxEntry(date: date, snapshot: first.snapshot, inbox: first.inbox, notifications: first.notifications, page: first.page)
            }
            completion(Timeline(entries: entries, policy: .after(next)))
        }
    }

    // The gallery preview must be instant, so it fetches nothing. A medium
    // tabs widget shows both halves, so it fetches both.
    private func load(at date: Date, isPreview: Bool, family: WidgetFamily) async -> InboxEntry {
        let snapshot = WidgetSnapshot.current
        let isSplit = content == .tabs && family != .systemSmall
        let page = content == .tabs && !isSplit ? WidgetPageStore.page(WidgetPageStore.inboxTabs) : 0
        var entry = InboxEntry(date: date, snapshot: snapshot, page: page)
        guard !isPreview, let feed = snapshot?.inboxFeed else { return entry }

        let wantsNotifications = isSplit || content == .notifications || (content == .tabs && page == 1)
        let wantsInbox = isSplit || content == .inbox || (content == .tabs && page == 0)
        async let inbox = fetchInbox(feed, snapshot, if: wantsInbox)
        async let notifications = fetchNotifications(feed, snapshot, if: wantsNotifications)
        entry.inbox = await inbox
        entry.notifications = await notifications
        return entry
    }

    private func fetchInbox(_ feed: WidgetSnapshot.InboxFeed, _ snapshot: WidgetSnapshot?, if wanted: Bool) async -> InboxSummary? {
        guard wanted, let priceFeed = snapshot?.priceFeed else { return nil }
        return await InboxFetcher.fetch(feed, priceFeed)
    }

    private func fetchNotifications(_ feed: WidgetSnapshot.InboxFeed, _ snapshot: WidgetSnapshot?, if wanted: Bool) async -> [NotificationRow]? {
        guard wanted, let notifications = feed.notifications else { return nil }
        return await InboxFetcher.notifications(
            notifications,
            apiKey: snapshot?.priceFeed?.apiKey ?? "",
            limit: InboxContent.notificationLimit
        )
    }
}

// MARK: - Shared pieces

private struct InboxHeader: View {
    let symbol: String
    let title: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: symbol).font(.system(size: 11, weight: .semibold))
            Text(title).font(PeraFont.medium(12))
        }
        .foregroundStyle(PeraColor.textGray)
        .lineLimit(1)
        // Keeps the header clear of the corner badge.
        .padding(.trailing, 24)
    }
}

private extension InboxItem.Kind {
    var symbol: String {
        switch self {
        case .sign: "signature"
        case .assets: "tray.and.arrow.down"
        case .invite: "person.2"
        }
    }

    var labelKey: String {
        switch self {
        case .sign: "inboxSign"
        case .assets: "inboxAssets"
        case .invite: "inboxInvite"
        }
    }
}

private func relative(_ date: Date, now: Date, locale: Locale) -> String {
    let formatter = RelativeDateTimeFormatter()
    formatter.locale = locale
    formatter.unitsStyle = .short
    formatter.dateTimeStyle = .named
    return formatter.localizedString(for: min(date, now), relativeTo: now)
}

/// Pera logo while there is nothing the widget may show: privacy mode, no
/// accounts yet, or a network without the inbox.
private struct InboxFrame<Content: View>: View {
    let entry: InboxEntry
    var url: URL?
    @ViewBuilder let content: () -> Content

    var body: some View {
        Group {
            if entry.snapshot?.inboxFeed == nil {
                VStack(spacing: 0) {
                    NetworkBar(network: entry.snapshot?.network)
                    PeraPlaceholder()
                }
            } else {
                content()
            }
        }
        .peraEnvironment(entry.snapshot)
        .containerBackground(for: .widget) { PeraColor.background }
        .widgetURL(url)
    }
}

// MARK: - Inbox (small): one count and a breakdown

private struct InboxCountView: View {
    let entry: InboxEntry
    /// Smaller count, for a widget whose tab bar takes the bottom.
    var isCompact = false

    var body: some View {
        InboxCountContent(entry: entry, countSize: isCompact ? 28 : 34)
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .peraChrome(network: entry.snapshot?.network)
    }
}

/// The count, "waiting" and the breakdown, without padding or chrome, so a
/// medium widget can use it as one of its halves.
private struct InboxCountContent: View {
    let entry: InboxEntry
    var countSize: CGFloat = 34

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            InboxHeader(symbol: "tray", title: entry.snapshot?.string("inbox") ?? "")
            Spacer(minLength: 0)
            if let inbox = entry.inbox {
                if inbox.total == 0 {
                    caughtUp
                } else {
                    Text("\(inbox.total)")
                        .font(PeraFont.bold(countSize))
                        .foregroundStyle(PeraColor.textMain)
                        .contentTransition(.numericText())
                    Text(entry.snapshot?.string("waiting") ?? "")
                        .font(PeraFont.medium(12))
                        .foregroundStyle(PeraColor.textGray)
                    breakdown(inbox)
                }
            } else {
                Text("—").font(PeraFont.bold(countSize)).foregroundStyle(PeraColor.textGray)
            }
        }
        .privacySensitive()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var caughtUp: some View {
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 22))
                .foregroundStyle(PeraColor.positive)
            Text(entry.snapshot?.string("inboxEmpty") ?? "")
                .font(PeraFont.bold(15))
                .foregroundStyle(PeraColor.textMain)
        }
    }

    private struct KindCount: Identifiable {
        let kind: InboxItem.Kind
        let count: Int
        var id: String { kind.symbol }
    }

    // Icon and count per kind, only the kinds that have something waiting.
    private func breakdown(_ inbox: InboxSummary) -> some View {
        let counts = [
            KindCount(kind: .sign, count: inbox.signatures.count),
            KindCount(kind: .assets, count: inbox.assetCount),
            KindCount(kind: .invite, count: inbox.inviteCount),
        ].filter { $0.count > 0 }
        return HStack(spacing: 8) {
            ForEach(counts) { entry in
                HStack(spacing: 2) {
                    Image(systemName: entry.kind.symbol).font(.system(size: 10, weight: .semibold))
                    Text("\(entry.count)").font(PeraFont.medium(11))
                }
                .foregroundStyle(PeraColor.textGray)
            }
        }
        .padding(.top, 2)
    }
}

struct InboxWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PeraInboxWidget", provider: InboxProvider(content: .inbox)) { entry in
            InboxFrame(entry: entry, url: InboxLinks.inbox) { InboxCountView(entry: entry) }
        }
        .configurationDisplayName(String(localized: "inbox.name"))
        .description(String(localized: "inbox.description"))
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

// MARK: - Inbox list (medium): the newest rows, each its own link

private struct InboxListView: View {
    let entry: InboxEntry
    var rowLimit = 3
    @Environment(\.locale) private var locale

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            InboxHeader(symbol: "tray", title: entry.snapshot?.string("inbox") ?? "")
            rows
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .clipped()
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    private var rows: some View {
        if let inbox = entry.inbox, !inbox.items.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(inbox.items.prefix(rowLimit)) { item in
                    Link(destination: InboxLinks.open(item) ?? InboxLinks.inbox!) { row(item) }
                }
            }
            .privacySensitive()
        } else {
            Text(entry.inbox == nil ? "—" : (entry.snapshot?.string("inboxEmpty") ?? ""))
                .font(PeraFont.medium(12))
                .foregroundStyle(PeraColor.textGray)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func row(_ item: InboxItem) -> some View {
        HStack(spacing: 8) {
            Image(systemName: item.kind.symbol)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(PeraColor.textMain)
                .frame(width: 24, height: 24)
                .background(PeraColor.layer, in: Circle())
            VStack(alignment: .leading, spacing: 1) {
                Text(entry.snapshot?.string(item.kind.labelKey) ?? "")
                    .font(PeraFont.medium(12))
                    .foregroundStyle(PeraColor.textMain)
                if let name = entry.snapshot?.inboxFeed?.name(of: item.address) {
                    Text(name)
                        .font(PeraFont.regular(10))
                        .foregroundStyle(PeraColor.textGray)
                }
            }
            .lineLimit(1)
            Spacer(minLength: 4)
            if item.kind == .assets {
                Text("\(item.count)")
                    .font(PeraFont.medium(11))
                    .foregroundStyle(PeraColor.textMain)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(PeraColor.layer, in: Capsule())
            } else if let date = item.date {
                Text(relative(date, now: entry.date, locale: locale))
                    .font(PeraFont.regular(10))
                    .foregroundStyle(PeraColor.textGray)
                    .lineLimit(1)
            }
        }
    }
}

struct InboxListWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PeraInboxListWidget", provider: InboxProvider(content: .inbox)) { entry in
            InboxFrame(entry: entry, url: InboxLinks.inbox) {
                InboxListView(entry: entry).peraChrome(network: entry.snapshot?.network)
            }
        }
        .configurationDisplayName(String(localized: "inboxList.name"))
        .description(String(localized: "inboxList.description"))
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

// MARK: - Signatures (small): multisig requests only

private struct SignaturesView: View {
    let entry: InboxEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            InboxHeader(symbol: "signature", title: entry.snapshot?.string("inboxSign") ?? "")
            Spacer(minLength: 0)
            if let count = entry.inbox?.signatures.count {
                if count == 0 {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(PeraColor.positive)
                    Text(entry.snapshot?.string("inboxEmpty") ?? "")
                        .font(PeraFont.bold(15))
                        .foregroundStyle(PeraColor.textMain)
                } else {
                    Text("\(count)")
                        .font(PeraFont.bold(34))
                        .foregroundStyle(PeraColor.textMain)
                        .contentTransition(.numericText())
                    Text(entry.snapshot?.string("toSign") ?? "")
                        .font(PeraFont.medium(12))
                        .foregroundStyle(PeraColor.textGray)
                }
            } else {
                Text("—").font(PeraFont.bold(34)).foregroundStyle(PeraColor.textGray)
            }
        }
        .privacySensitive()
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .peraChrome(network: entry.snapshot?.network)
    }
}

struct SignaturesWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PeraSignaturesWidget", provider: InboxProvider(content: .inbox)) { entry in
            // One request opens it directly; several open the inbox to choose.
            let signatures = entry.inbox?.signatures ?? []
            InboxFrame(entry: entry, url: signatures.count == 1 ? InboxLinks.open(signatures[0]) : InboxLinks.inbox) {
                SignaturesView(entry: entry)
            }
        }
        .configurationDisplayName(String(localized: "signatures.name"))
        .description(String(localized: "signatures.description"))
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

// MARK: - Notifications (medium)

private struct NotificationsListView: View {
    let entry: InboxEntry
    var rowLimit = InboxContent.notificationLimit
    /// Zero when it is one half of a medium widget, which pads both halves.
    var padding: CGFloat = 14
    @Environment(\.locale) private var locale

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            InboxHeader(symbol: "bell", title: entry.snapshot?.string("notifications") ?? "")
            rows
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .clipped()
        }
        .padding(padding)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    private var rows: some View {
        if let notifications = entry.notifications, !notifications.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(notifications.prefix(rowLimit)) { row($0) }
            }
            // Notification text can name amounts and accounts.
            .privacySensitive()
        } else {
            Text(entry.notifications == nil ? "—" : (entry.snapshot?.string("notificationsEmpty") ?? ""))
                .font(PeraFont.medium(12))
                .foregroundStyle(PeraColor.textGray)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    // A dot as well as weight for unread: tinted rendering modes drop colour.
    private func row(_ notification: NotificationRow) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Circle()
                .fill(notification.isUnread ? PeraColor.positive : Color.clear)
                .frame(width: 6, height: 6)
            Text(notification.message)
                .font(notification.isUnread ? PeraFont.medium(12) : PeraFont.regular(12))
                .foregroundStyle(PeraColor.textMain)
                .lineLimit(1)
            Spacer(minLength: 4)
            Text(relative(notification.date, now: entry.date, locale: locale))
                .font(PeraFont.regular(10))
                .foregroundStyle(PeraColor.textGray)
                .lineLimit(1)
                .fixedSize()
        }
    }
}

struct NotificationsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PeraNotificationsWidget", provider: InboxProvider(content: .notifications)) { entry in
            InboxFrame(entry: entry, url: InboxLinks.notifications) {
                NotificationsListView(entry: entry).peraChrome(network: entry.snapshot?.network)
            }
        }
        .configurationDisplayName(String(localized: "notifications.name"))
        .description(String(localized: "notifications.description"))
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

// MARK: - Inbox | Notifications (medium, tabs)

/// Inbox and notifications in one widget: side by side in medium, each half
/// its own link; switched by a tab bar in small, where only one fits.
struct InboxTabsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PeraInboxTabsWidget", provider: InboxProvider(content: .tabs)) { entry in
            InboxTabsView(entry: entry)
        }
        .configurationDisplayName(String(localized: "inboxTabs.name"))
        .description(String(localized: "inboxTabs.description"))
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

private struct InboxTabsView: View {
    let entry: InboxEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        InboxFrame(entry: entry, url: family == .systemSmall && entry.page == 1 ? InboxLinks.notifications : InboxLinks.inbox) {
            if family == .systemSmall { tabs } else { split }
        }
    }

    private var split: some View {
        HStack(alignment: .top, spacing: 12) {
            Link(destination: InboxLinks.inbox!) { InboxCountContent(entry: entry, countSize: 30) }
            Divider()
            Link(destination: InboxLinks.notifications!) { NotificationsListView(entry: entry, padding: 0) }
        }
        .padding(14)
        .peraChrome(network: entry.snapshot?.network)
    }

    private var tabs: some View {
        VStack(spacing: 0) {
            if entry.page == 1 {
                NotificationsListView(entry: entry, rowLimit: 2).peraChrome(network: entry.snapshot?.network)
            } else {
                InboxCountView(entry: entry, isCompact: true)
            }
            SegmentedPageBar(
                key: WidgetPageStore.inboxTabs,
                tabs: [
                    WidgetPageTab(symbol: "tray", label: entry.snapshot?.string("inbox") ?? ""),
                    WidgetPageTab(symbol: "bell", label: entry.snapshot?.string("notifications") ?? ""),
                ],
                selected: entry.page
            )
            .padding([.horizontal, .bottom], 10)
        }
    }
}

// MARK: - Previews

private extension InboxSummary {
    static let fixture = InboxSummary(
        items: [
            InboxItem(id: "sign-1", kind: .sign, address: "VAULT", count: 1, date: .now.addingTimeInterval(-600), signRequestId: "1"),
            InboxItem(id: "invite-T", kind: .invite, address: "TREASURY", count: 1, date: .now.addingTimeInterval(-7200), signRequestId: nil),
            InboxItem(id: "assets-MAIN", kind: .assets, address: "MAIN", count: 2, date: nil, signRequestId: nil),
        ],
        fetchedAt: .now
    )
}

private extension NotificationRow {
    static let fixtures = [
        NotificationRow(id: "1", message: "You received 25 ALGO", date: .now.addingTimeInterval(-300), isUnread: true),
        NotificationRow(id: "2", message: "Swap completed: USDC → ALGO", date: .now.addingTimeInterval(-5400), isUnread: false),
        NotificationRow(id: "3", message: "New asset available to claim", date: .now.addingTimeInterval(-90000), isUnread: false),
    ]
}

#Preview("Inbox", as: .systemSmall) {
    InboxWidget()
} timeline: {
    InboxEntry(date: .now, snapshot: .fixtureMainnet, inbox: .fixture)
    InboxEntry(date: .now, snapshot: .fixtureMainnet, inbox: InboxSummary(items: [], fetchedAt: .now))
    InboxEntry(date: .now, snapshot: .fixtureTestnetHidden)
}

#Preview("Inbox list", as: .systemMedium) {
    InboxListWidget()
} timeline: {
    InboxEntry(date: .now, snapshot: .fixtureMainnet, inbox: .fixture)
}

#Preview("Signatures", as: .systemSmall) {
    SignaturesWidget()
} timeline: {
    InboxEntry(date: .now, snapshot: .fixtureMainnet, inbox: .fixture)
}

#Preview("Notifications", as: .systemMedium) {
    NotificationsWidget()
} timeline: {
    InboxEntry(date: .now, snapshot: .fixtureMainnet, notifications: NotificationRow.fixtures)
}

#Preview("Inbox and notifications, medium", as: .systemMedium) {
    InboxTabsWidget()
} timeline: {
    InboxEntry(date: .now, snapshot: .fixtureMainnet, inbox: .fixture, notifications: NotificationRow.fixtures)
    InboxEntry(date: .now, snapshot: .fixtureMainnet, inbox: InboxSummary(items: [], fetchedAt: .now), notifications: [])
}

#Preview("Inbox and notifications, small", as: .systemSmall) {
    InboxTabsWidget()
} timeline: {
    InboxEntry(date: .now, snapshot: .fixtureMainnet, inbox: .fixture, page: 0)
    InboxEntry(date: .now, snapshot: .fixtureMainnet, notifications: NotificationRow.fixtures, page: 1)
}
