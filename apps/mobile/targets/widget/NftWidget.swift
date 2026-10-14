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

struct NftProvider: TimelineProvider {
    private static let rotation: TimeInterval = 60 * 60

    func placeholder(in context: Context) -> NftEntry {
        NftEntry(date: .now, snapshot: nil, nft: nil, image: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (NftEntry) -> Void) {
        let snapshot = WidgetSnapshot.current
        completion(entry(at: .now, snapshot: snapshot, nft: visibleNfts(snapshot).first))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NftEntry>) -> Void) {
        let snapshot = WidgetSnapshot.current
        let nfts = visibleNfts(snapshot)
        guard !nfts.isEmpty else {
            completion(Timeline(entries: [entry(at: .now, snapshot: snapshot, nft: nil)], policy: .never))
            return
        }
        let start = Date.now
        let entries = nfts.enumerated().map { index, nft in
            entry(at: start.addingTimeInterval(Double(index) * Self.rotation), snapshot: snapshot, nft: nft)
        }
        completion(Timeline(entries: entries, policy: .atEnd))
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
        ZStack(alignment: .top) {
            if let nft = entry.nft, let image = entry.image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()
                    .overlay(alignment: .bottomLeading) { caption(nft) }
            } else {
                emptyState
            }
            NetworkBar(network: entry.snapshot?.network)
        }
        .peraEnvironment(entry.snapshot)
        .containerBackground(for: .widget) { PeraColor.background }
        // Opening the NFT itself needs a deep link that resolves the holder in-app;
        // the snapshot deliberately carries no addresses.
        .widgetURL(URL(string: "perawallet://app/"))
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
        StaticConfiguration(kind: "PeraNftWidget", provider: NftProvider()) { entry in
            NftWidgetView(entry: entry)
        }
        .configurationDisplayName(String(localized: "nft.name"))
        .description(String(localized: "nft.description"))
        .supportedFamilies([.systemSmall, .systemLarge])
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
