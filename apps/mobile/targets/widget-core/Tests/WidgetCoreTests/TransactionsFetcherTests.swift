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

final class TransactionsFetcherTests: XCTestCase {
    override func tearDown() {
        StubURLProtocol.uninstall()
        super.tearDown()
    }

    private func impact(_ assetId: String, _ unit: String, _ decimals: Int, _ amount: String) -> String {
        "{ \"asset_id\": \(assetId), \"unit_name\": \"\(unit)\", \"fraction_decimals\": \(decimals), \"amount\": \"\(amount)\" }"
    }

    private func item(
        _ id: String,
        type: String = "pay",
        time: Int = 100,
        impacts: [String] = [],
        swap: String? = nil,
        closeTo: String? = nil
    ) -> String {
        let swapField = swap.map { ", \"swap_group_detail\": \($0)" } ?? ""
        let closeField = closeTo.map { ", \"close_to\": \"\($0)\"" } ?? ""
        return "{ \"id\": \"\(id)\", \"tx_type\": \"\(type)\", \"round_time\": \(time), \"balance_impacts\": [\(impacts.joined(separator: ","))]\(swapField)\(closeField) }"
    }

    private func page(_ items: [String]) -> StubURLProtocol.Response {
        ok("{ \"results\": [\(items.joined(separator: ","))] }")
    }

    private let fee = "{ \"asset_id\": 0, \"unit_name\": \"ALGO\", \"fraction_decimals\": 6, \"amount\": \"-1000\" }"

    private func rows(_ items: [String], limit: Int = 5) async throws -> [TransactionRow] {
        StubURLProtocol.install(["/v1/accounts/A/transactions/": page(items)])
        let fetched = await TransactionsFetcher.fetch(addresses: ["A"], limit: limit, locale: english, testFeed)
        return try XCTUnwrap(fetched)
    }

    // The ALGO impact includes the fee, so the other asset is what moved.
    func testShowsTheReceivedAssetRatherThanTheFee() async throws {
        let result = try await rows([item("1", type: "axfer", impacts: [fee, impact("31566704", "USDC", 6, "250000000")])])

        XCTAssertEqual(result.first?.kind, .receive)
        XCTAssertEqual(result.first?.amount, "250 USDC")
    }

    func testShowsASentALGOAmount() async throws {
        let result = try await rows([item("1", impacts: [impact("0", "ALGO", 6, "-25001000")])])

        XCTAssertEqual(result.first?.kind, .send)
        XCTAssertEqual(result.first?.amount, "25.001 ALGO")
    }

    func testNamesALGOWhenTheBackendSendsNoUnit() async throws {
        let result = try await rows([item("1", impacts: [impact("0", "", 6, "-1000000")])])

        XCTAssertEqual(result.first?.amount, "1 ALGO")
    }

    func testShowsASwapAsFromAndToUnits() async throws {
        let swap = "{ \"asset_in\": { \"unit_name\": \"USDC\" }, \"asset_out\": { \"unit_name\": \"ALGO\" } }"

        let result = try await rows([item("1", type: "appl", impacts: [fee], swap: swap)])

        XCTAssertEqual(result.first?.kind, .swap)
        XCTAssertEqual(result.first?.amount, "USDC → ALGO")
    }

    func testClassifiesAnAssetTransferThatOnlyCostsAFeeAsAnOptIn() async throws {
        let result = try await rows([item("1", type: "axfer", impacts: [fee])])

        XCTAssertEqual(result.first?.kind, .optIn)
        XCTAssertNil(result.first?.amount)
    }

    func testClassifiesAClosingAssetTransferAsAnOptOut() async throws {
        let result = try await rows([item("1", type: "axfer", impacts: [fee], closeTo: "CLOSE")])

        XCTAssertEqual(result.first?.kind, .optOut)
    }

    func testShowsAPlainAppCallWithoutAnAmount() async throws {
        let result = try await rows([item("1", type: "appl", impacts: [fee])])

        XCTAssertEqual(result.first?.kind, .appCall)
        XCTAssertNil(result.first?.amount)
    }

    func testShowsAnAppCallThatPaysOutAnAssetAsAReceive() async throws {
        let result = try await rows([item("1", type: "appl", impacts: [fee, impact("31566704", "USDC", 6, "5000000")])])

        XCTAssertEqual(result.first?.kind, .receive)
        XCTAssertEqual(result.first?.amount, "5 USDC")
    }

    func testIgnoresZeroAmountImpacts() async throws {
        let result = try await rows([item("1", type: "axfer", impacts: [fee, impact("31566704", "USDC", 6, "0")])])

        XCTAssertEqual(result.first?.kind, .optIn)
    }

    func testMergesAccountsNewestFirstWithoutDuplicatesAndHonoursTheLimit() async throws {
        StubURLProtocol.install([
            "/v1/accounts/A/transactions/": page([item("old", time: 100), item("shared", time: 300)]),
            "/v1/accounts/B/transactions/": page([item("middle", time: 200), item("shared", time: 300)]),
        ])

        let fetched = await TransactionsFetcher.fetch(addresses: ["A", "B"], limit: 2, locale: english, testFeed)
        let result = try XCTUnwrap(fetched)

        XCTAssertEqual(result.map(\.id), ["shared", "middle"])
    }

    func testReadsAtMostFiveAccounts() async {
        StubURLProtocol.install([:])

        _ = await TransactionsFetcher.fetch(addresses: ["A", "B", "C", "D", "E", "F", "G"], limit: 3, locale: english, testFeed)

        XCTAssertEqual(StubURLProtocol.requests.count, 5)
    }

    func testKeepsTheAccountsThatLoadedWhenOthersFail() async throws {
        StubURLProtocol.install(["/v1/accounts/A/transactions/": page([item("1")])])

        let fetched = await TransactionsFetcher.fetch(addresses: ["A", "B"], limit: 3, locale: english, testFeed)
        let result = try XCTUnwrap(fetched)

        XCTAssertEqual(result.map(\.id), ["1"])
    }

    func testFailsWhenEveryAccountFails() async {
        StubURLProtocol.install([:])

        let result = await TransactionsFetcher.fetch(addresses: ["A", "B"], limit: 3, locale: english, testFeed)

        XCTAssertNil(result)
    }
}
