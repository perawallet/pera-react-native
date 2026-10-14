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

struct SnapshotEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
    let cachedImageCount: Int
}

struct DebugProvider: TimelineProvider {
    func placeholder(in context: Context) -> SnapshotEntry {
        SnapshotEntry(date: .now, snapshot: nil, cachedImageCount: 0)
    }

    func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
        completion(currentEntry())
    }

    // The app reloads timelines on every write, so no refresh schedule is needed.
    func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
        completion(Timeline(entries: [currentEntry()], policy: .never))
    }

    private func currentEntry() -> SnapshotEntry {
        SnapshotEntry(date: .now, snapshot: .current, cachedImageCount: SnapshotStore.cachedImageCount)
    }
}

struct DebugWidgetView: View {
    let entry: SnapshotEntry

    var body: some View {
        Group {
            if let snapshot = entry.snapshot {
                VStack(alignment: .leading, spacing: 0) {
                    NetworkBar(network: snapshot.network)
                    VStack(alignment: .leading, spacing: 3) {
                        row("locale", snapshot.locale)
                        row("theme", snapshot.theme)
                        row(snapshot.string("algoPrice") ?? "price", snapshot.algoPrice?.formatted)
                        if let date = snapshot.algoPrice?.date {
                            UpdatedLabel(prefix: snapshot.string("updated"), date: date)
                        }
                        row(snapshot.string("portfolio") ?? "portfolio", portfolioText(snapshot))
                        row("nfts", nftsText(snapshot))
                        row("images", "\(entry.cachedImageCount)")
                    }
                    .padding(12)
                    Spacer(minLength: 0)
                }
            } else {
                PeraPlaceholder()
            }
        }
        .peraEnvironment(entry.snapshot)
        .containerBackground(for: .widget) { PeraColor.background }
    }

    private func row(_ label: String, _ value: String?) -> some View {
        HStack {
            Text(label).foregroundStyle(PeraColor.textGray)
            Spacer()
            Text(value ?? "—").foregroundStyle(PeraColor.textMain)
        }
        .font(PeraFont.regular(12))
        .lineLimit(1)
    }

    private func portfolioText(_ snapshot: WidgetSnapshot) -> String? {
        guard let portfolio = snapshot.portfolio else { return nil }
        return portfolio.state == "hidden" ? "••••" : portfolio.formatted
    }

    private func nftsText(_ snapshot: WidgetSnapshot) -> String? {
        guard let nfts = snapshot.nfts else { return nil }
        return nfts.state == "hidden" ? snapshot.string("hidden") : "\(nfts.items?.count ?? 0)"
    }
}

struct DebugWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PeraDebugWidget", provider: DebugProvider()) { entry in
            DebugWidgetView(entry: entry)
        }
        .configurationDisplayName(String(localized: "debug.name"))
        .description(String(localized: "debug.description"))
        .supportedFamilies([.systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

#Preview("Mainnet", as: .systemMedium) {
    DebugWidget()
} timeline: {
    SnapshotEntry(date: .now, snapshot: .fixtureMainnet, cachedImageCount: 3)
    SnapshotEntry(date: .now, snapshot: .fixtureTestnetHidden, cachedImageCount: 0)
    SnapshotEntry(date: .now, snapshot: nil, cachedImageCount: 0)
}
