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
import XCTest
@testable import WidgetCore

final class NftScheduleTests: XCTestCase {
    private func nft(_ id: String) -> WidgetSnapshot.Nft {
        WidgetSnapshot.Nft(assetId: id, title: "NFT \(id)", collectionName: nil, imageKey: id)
    }

    private let anchor = Date(timeIntervalSince1970: 1_760_000_000)
    private let sixHours: TimeInterval = 6 * 60 * 60

    func testTheSameSeedGivesTheSameOrderWhateverTheListOrder() {
        let nfts = ["1", "2", "3", "4", "5"].map(nft)

        let first = NftSchedule.order(nfts, pickedId: nil, seed: 42)
        let reversed = NftSchedule.order(nfts.reversed(), pickedId: nil, seed: 42)

        XCTAssertEqual(first.map(\.assetId), reversed.map(\.assetId))
        XCTAssertEqual(Set(first.map(\.assetId)), Set(["1", "2", "3", "4", "5"]))
    }

    func testAPickedNftComesFirst() {
        let order = NftSchedule.order(["1", "2", "3"].map(nft), pickedId: "3", seed: 7)

        XCTAssertEqual(order.first?.assetId, "3")
        XCTAssertEqual(order.count, 3)
    }

    // The bug this guards: an app write rebuilt the timeline and showed a new
    // NFT long before the interval was up.
    func testARebuildWithinAnIntervalKeepsTheSameNft() {
        let order = ["1", "2", "3"].map(nft)

        let early = NftSchedule.slots(order, anchor: anchor, interval: sixHours, now: anchor.addingTimeInterval(60))
        let later = NftSchedule.slots(order, anchor: anchor, interval: sixHours, now: anchor.addingTimeInterval(5 * 3600))

        XCTAssertEqual(early.first?.nft, later.first?.nft)
    }

    func testTheNftChangesAtTheIntervalBoundary() {
        let order = ["1", "2", "3"].map(nft)
        let now = anchor.addingTimeInterval(60)

        let slots = NftSchedule.slots(order, anchor: anchor, interval: sixHours, now: now)

        XCTAssertEqual(slots.map(\.nft.assetId), ["1", "2", "3"])
        XCTAssertEqual(slots[0].start, now)
        XCTAssertEqual(slots[1].start, anchor.addingTimeInterval(sixHours))
        let nextDay = NftSchedule.slots(order, anchor: anchor, interval: sixHours, now: anchor.addingTimeInterval(4 * sixHours + 1))
        XCTAssertEqual(nextDay.first?.nft.assetId, "2")
    }

    func testNoSlotsWithoutNfts() {
        XCTAssertTrue(NftSchedule.slots([], anchor: anchor, interval: sixHours, now: anchor).isEmpty)
    }
}
