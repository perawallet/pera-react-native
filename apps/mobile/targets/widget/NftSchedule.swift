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

/// Which NFT shows when. A timeline is rebuilt whenever the app writes new
/// data, so the order and the current slot are derived from a stored start
/// time rather than drawn afresh: a rebuild lands on the NFT already showing
/// and moves on only at the next interval boundary.
enum NftSchedule {
    struct Slot: Equatable {
        let nft: WidgetSnapshot.Nft
        let start: Date
    }

    /// The picked NFT first, then the rest in a random order fixed by `seed`.
    /// Sorted by asset id before shuffling so the app's list order can't move it.
    static func order(_ nfts: [WidgetSnapshot.Nft], pickedId: String?, seed: UInt64) -> [WidgetSnapshot.Nft] {
        let picked = pickedId.flatMap { id in nfts.first { $0.assetId == id } }
        var generator = SeededGenerator(seed: seed)
        let rest = nfts
            .filter { $0.assetId != picked?.assetId }
            .sorted { $0.assetId < $1.assetId }
            .shuffled(using: &generator)
        return (picked.map { [$0] } ?? []) + rest
    }

    /// One full cycle from the slot containing `now`. The first slot starts at
    /// `now`; each later one at its boundary counted from `anchor`.
    static func slots(_ order: [WidgetSnapshot.Nft], anchor: Date, interval: TimeInterval, now: Date) -> [Slot] {
        guard !order.isEmpty, interval > 0 else { return [] }
        let current = Int(max(0, now.timeIntervalSince(anchor)) / interval)
        return (0..<order.count).map { step in
            let slot = current + step
            let start = step == 0 ? now : anchor.addingTimeInterval(Double(slot) * interval)
            return Slot(nft: order[slot % order.count], start: start)
        }
    }

    /// When this configuration's rotation began, recorded on first use and kept
    /// in the App Group so every rebuild agrees.
    static func anchor(for key: String, now: Date = .now) -> Date {
        let defaults = SnapshotStore.appGroup.flatMap(UserDefaults.init(suiteName:))
        let storageKey = "pera.widgets.nft.anchor.\(key)"
        if let stored = defaults?.object(forKey: storageKey) as? Double {
            return Date(timeIntervalSince1970: stored)
        }
        defaults?.set(now.timeIntervalSince1970, forKey: storageKey)
        return now
    }

    static func seed(for anchor: Date) -> UInt64 {
        UInt64(max(0, anchor.timeIntervalSince1970 * 1000))
    }
}

/// SplitMix64: a small generator whose sequence depends only on its seed,
/// unlike the system one, so the same seed always gives the same shuffle.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) { state = seed }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var value = state
        value = (value ^ (value >> 30)) &* 0xBF58_476D_1CE4_E5B9
        value = (value ^ (value >> 27)) &* 0x94D0_49BB_1331_11EB
        return value ^ (value >> 31)
    }
}
