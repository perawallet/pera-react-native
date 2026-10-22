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

struct NftEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
    let nft: WidgetSnapshot.Nft?
    let image: UIImage?
}

struct NftProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> NftEntry {
        NftEntry(date: .now, snapshot: nil, nft: nil, image: nil)
    }

    func snapshot(for configuration: NftConfigIntent, in context: Context) async -> NftEntry {
        let snapshot = WidgetSnapshot.current
        return entry(at: .now, snapshot: snapshot, nft: schedule(snapshot, configuration).first?.nft)
    }

    func timeline(for configuration: NftConfigIntent, in context: Context) async -> Timeline<NftEntry> {
        let snapshot = WidgetSnapshot.current
        let slots = schedule(snapshot, configuration)
        // One slot (the only NFT, or "Never") stays until the app writes again.
        guard slots.count > 1 else {
            return Timeline(entries: [entry(at: .now, snapshot: snapshot, nft: slots.first?.nft)], policy: .never)
        }
        let entries = slots.map { entry(at: $0.start, snapshot: snapshot, nft: $0.nft) }
        return Timeline(entries: entries, policy: .atEnd)
    }

    // A pick no longer cached (sold, or hidden) falls back to random. The order
    // and current slot come from a stored start time, so the frequent rebuilds
    // an app write causes keep showing the same NFT until its interval ends.
    private func schedule(_ snapshot: WidgetSnapshot?, _ configuration: NftConfigIntent) -> [NftSchedule.Slot] {
        let all = visibleNfts(snapshot)
        let pickedId = configuration.nft.map(\.id).flatMap { id in all.contains { $0.assetId == id } ? id : nil }
        let anchor = NftSchedule.anchor(for: pickedId ?? NftEntity.randomId)
        let order = NftSchedule.order(all, pickedId: pickedId, seed: NftSchedule.seed(for: anchor))
        guard let interval = configuration.rotation.interval else {
            return order.first.map { [NftSchedule.Slot(nft: $0, start: .now)] } ?? []
        }
        return NftSchedule.slots(order, anchor: anchor, interval: interval, now: .now)
    }

    private func visibleNfts(_ snapshot: WidgetSnapshot?) -> [WidgetSnapshot.Nft] {
        guard snapshot?.nfts?.state == "visible" else { return [] }
        return snapshot?.nfts?.items ?? []
    }

    // Images were downsampled by the app, so loading one here stays well inside
    // the extension's memory budget.
    private func entry(at date: Date, snapshot: WidgetSnapshot?, nft: WidgetSnapshot.Nft?) -> NftEntry {
        let image = nft
            .flatMap { SnapshotStore.imageURL(forKey: $0.imageKey) }
            .flatMap { UIImage(contentsOfFile: $0.path) }
        return NftEntry(date: date, snapshot: snapshot, nft: nft, image: image)
    }
}

struct NftWidgetView: View {
    let entry: NftEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            if let nft = entry.nft, let image = entry.image {
                // Sized by Color.clear, not the image: a scaledToFill image
                // reports a size larger than the widget, which pushed the
                // corner badge off-screen.
                Color.clear
                    .overlay {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                    }
                    .clipped()
                    .overlay(alignment: .bottomLeading) { caption(nft) }
                    // Holdings: redacted while the phone is locked (StandBy, Mac desktop).
                    .privacySensitive()
                    .peraChrome(network: entry.snapshot?.network)
            } else {
                // The placeholder already is the logo; no badge on top of it.
                VStack(spacing: 0) {
                    NetworkBar(network: entry.snapshot?.network)
                    emptyState
                }
            }
        }
        .peraEnvironment(entry.snapshot)
        .containerBackground(for: .widget) { PeraColor.background }
        // nft-detail takes no address: the app selects whichever account holds it.
        .widgetURL(nftURL)
    }

    private var nftURL: URL? {
        guard let nft = entry.nft else { return URL(string: "perawallet://app/") }
        return URL(string: "perawallet://app/nft-detail/?assetId=\(nft.assetId)")
    }

    private func caption(_ nft: WidgetSnapshot.Nft) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(nft.title)
                .font(PeraFont.bold(family == .systemSmall ? 12 : 15))
            if let collection = nft.collectionName {
                Text(collection).font(PeraFont.regular(family == .systemSmall ? 10 : 12))
            }
        }
        .lineLimit(1)
        .foregroundStyle(.white)
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LinearGradient(colors: [.clear, .black.opacity(0.6)], startPoint: .top, endPoint: .bottom))
    }

    @ViewBuilder
    private var emptyState: some View {
        if entry.snapshot?.nfts?.state == "visible" {
            VStack(spacing: 8) {
                PeraPlaceholder().frame(height: 50)
                Text(entry.snapshot?.string("nftsEmpty") ?? "")
                    .font(PeraFont.medium(12))
                    .foregroundStyle(PeraColor.textGray)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            PeraPlaceholder()
        }
    }
}

struct NftWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "PeraNftWidget", intent: NftConfigIntent.self, provider: NftProvider()) { entry in
            NftWidgetView(entry: entry)
        }
        .configurationDisplayName(String(localized: "nft.name"))
        .description(String(localized: "nft.description"))
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

#Preview("NFT", as: .systemSmall) {
    NftWidget()
} timeline: {
    NftEntry(date: .now, snapshot: .fixtureMainnet, nft: WidgetSnapshot.fixtureMainnet.nfts?.items?.first, image: UIImage(systemName: "photo.artframe"))
    NftEntry(date: .now, snapshot: .fixtureTestnetHidden, nft: nil, image: nil)
    NftEntry(date: .now, snapshot: .fixtureEmpty, nft: nil, image: nil)
    NftEntry(date: .now, snapshot: nil, nft: nil, image: nil)
}
