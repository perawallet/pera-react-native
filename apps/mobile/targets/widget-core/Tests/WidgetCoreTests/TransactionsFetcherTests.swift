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

// The same cases as the Android widget's TransactionsFetcherTest.kt: both port the app's history rules.
final class TransactionsFetcherTests: XCTestCase {
    override func tearDown() {
        StubURLProtocol.uninstall()
        super.tearDown()
    }

    private func page(_ items: String...) -> StubURLProtocol.Response {
        ok("{ \"results\": [\(items.joined(separator: ","))] }")
    }

    // The ALGO impact nets amount + fee for the sender, as the backend sends it.
    private func pay(_ id: String, _ time: Int, _ sender: String, _ receiver: String, _ amount: Int, fee: Int = 1000) -> String {
        """
        { "id": "\(id)", "tx_type": "pay", "round_time": \(time), "sender": "\(sender)", "receiver": "\(receiver)",
          "amount": "\(amount)", "fee": "\(fee)",
          "balance_impacts": [{ "asset_id": 0, "unit_name": "ALGO", "fraction_decimals": 6, "amount": "-\(amount + fee)" }] }
        """
    }

    private func fetch(_ routes: [String: StubURLProtocol.Response], _ addresses: [String], limit: Int = 6) async -> [TransactionRow]? {
        StubURLProtocol.install(routes)
        return await TransactionsFetcher.fetch(addresses: addresses, limit: limit, locale: english, testFeed)
    }

    private func rows(_ item: String, account: String = "A") async throws -> [TransactionRow] {
        let fetched = await fetch(["/v1/accounts/\(account)/transactions/": page(item)], [account])
        return try XCTUnwrap(fetched)
    }

    func testAPaymentShowsTheAmountSentWithoutTheFee() async throws {
        let fetchedRows = try await rows(pay("1", 100, "A", "B", 25_000_000))
        let row = try XCTUnwrap(fetchedRows.first)

        XCTAssertEqual(row.kind, .send)
        XCTAssertEqual(row.amount, "25 ALGO")
    }

    func testTheReceiverSeesAReceive() async throws {
        let fetchedRows = try await rows(pay("1", 100, "B", "A", 1_500_000))
        let row = try XCTUnwrap(fetchedRows.first)

        XCTAssertEqual(row.kind, .receive)
        XCTAssertEqual(row.amount, "1.5 ALGO")
    }

    func testALGOIgnoresTheBackendsPlaceholderFacts() async throws {
        let item = """
        { "id": "1", "tx_type": "pay", "round_time": 100, "sender": "A", "receiver": "B", "amount": "1000000",
          "asset": { "asset_id": 0, "unit_name": "asset(0)", "fraction_decimals": 0 } }
        """

        let fetchedRows = try await rows(item)

        XCTAssertEqual(fetchedRows.first?.amount, "1 ALGO")
    }

    func testAnAssetTransferUsesTheAssetsDecimals() async throws {
        let item = """
        { "id": "1", "tx_type": "axfer", "round_time": 100, "sender": "A", "receiver": "B", "amount": "120000000",
          "asset": { "asset_id": 31566704, "unit_name": "USDC", "fraction_decimals": 6 } }
        """
        let fetchedRows = try await rows(item)
        let row = try XCTUnwrap(fetchedRows.first)

        XCTAssertEqual(row.kind, .send)
        XCTAssertEqual(row.amount, "120 USDC")
    }

    func testAZeroTransferToSelfIsAnOptInAndACloseOutIsAnOptOut() async throws {
        let optIn = """
        { "id": "1", "tx_type": "axfer", "round_time": 200, "sender": "A", "receiver": "A", "amount": "0",
          "asset": { "asset_id": 5, "unit_name": "X", "fraction_decimals": 0 } }
        """
        let optOut = """
        { "id": "2", "tx_type": "axfer", "round_time": 100, "sender": "A", "receiver": "A", "amount": "0",
          "close_to": "C", "asset": { "asset_id": 5, "unit_name": "X", "fraction_decimals": 0 } }
        """
        let fetched = await fetch(["/v1/accounts/A/transactions/": page(optIn, optOut)], ["A"])
        let result = try XCTUnwrap(fetched)

        XCTAssertEqual(result.map(\.kind), [.optIn, .optOut])
        XCTAssertTrue(result.allSatisfy { $0.amount == nil })
    }

    func testAnIncomingZeroTransferIsAReceiveNotAnOptIn() async throws {
        let item = """
        { "id": "1", "tx_type": "axfer", "round_time": 100, "sender": "B", "receiver": "A", "amount": "0",
          "asset": { "asset_id": 5, "unit_name": "X", "fraction_decimals": 0 } }
        """

        let fetchedRows = try await rows(item)

        XCTAssertEqual(fetchedRows.first?.kind, .receive)
    }

    func testConsensusAndAssetAdminRowsAreNotSends() async throws {
        for type in ["keyreg", "hb", "acfg", "afrz", "stpf"] {
            let item = """
            { "id": "1", "tx_type": "\(type)", "round_time": 100, "sender": "A", "fee": "2000000",
              "balance_impacts": [{ "asset_id": 0, "unit_name": "ALGO", "fraction_decimals": 6, "amount": "-2000000" }] }
            """
            let fetchedRows = try await rows(item)
            let row = try XCTUnwrap(fetchedRows.first, type)

            XCTAssertEqual(row.kind, .other, type)
            XCTAssertNil(row.amount, type)
        }
    }

    func testACloseOutSendsTheAmountAndTheSweep() async throws {
        let item = """
        { "id": "1", "tx_type": "pay", "round_time": 100, "sender": "A", "receiver": "B", "close_to": "C",
          "amount": "1000000", "fee": "1000",
          "balance_impacts": [{ "asset_id": 0, "unit_name": "ALGO", "fraction_decimals": 6, "amount": "-5001000" }] }
        """

        let fetchedRows = try await rows(item)

        XCTAssertEqual(fetchedRows.first?.amount, "5 ALGO")
    }

    func testAnAppCallHasNoAmount() async throws {
        let item = """
        { "id": "1", "tx_type": "appl", "round_time": 100, "sender": "A",
          "balance_impacts": [{ "asset_id": 31566704, "unit_name": "USDC", "fraction_decimals": 6, "amount": "5000000" }] }
        """
        let fetchedRows = try await rows(item)
        let row = try XCTUnwrap(fetchedRows.first)

        XCTAssertEqual(row.kind, .appCall)
        XCTAssertNil(row.amount)
    }

    func testASwapShowsBothUnits() async throws {
        let swap = """
        { "id": "1", "tx_type": "appl", "round_time": 100,
          "swap_group_detail": { "asset_in": { "asset_id": 31566704, "unit_name": "USDC" }, "asset_out": { "asset_id": 0 } } }
        """
        let fetchedRows = try await rows(swap)
        let row = try XCTUnwrap(fetchedRows.first)

        XCTAssertEqual(row.kind, .swap)
        XCTAssertEqual(row.amount, "USDC → ALGO")
    }

    func testATransferBetweenOwnAccountsAlwaysReadsFromTheFirstAccount() async throws {
        let shared = pay("shared", 300, "A", "B", 1_000_000)
        let routes = [
            "/v1/accounts/A/transactions/": page(shared, pay("a", 100, "X", "A", 1_000_000)),
            "/v1/accounts/B/transactions/": page(shared, pay("b", 200, "X", "B", 1_000_000)),
        ]
        for _ in 0..<5 {
            let fetched = await fetch(routes, ["A", "B"], limit: 2)
            let result = try XCTUnwrap(fetched)

            XCTAssertEqual(result.map(\.id), ["shared", "b"])
            XCTAssertEqual(result.first?.kind, .send)
        }
    }

    func testOneFailedAccountStillShowsTheOthers() async throws {
        let fetched = await fetch(["/v1/accounts/A/transactions/": page(pay("a", 100, "X", "A", 1_000_000))], ["A", "B"])
        let result = try XCTUnwrap(fetched)

        XCTAssertEqual(result.map(\.id), ["a"])
    }

    func testAMalformedRowDoesNotHideTheRest() async throws {
        let fetched = await fetch(["/v1/accounts/A/transactions/": page("{ \"id\": \"broken\" }", pay("a", 100, "X", "A", 1))], ["A"])
        let result = try XCTUnwrap(fetched)

        XCTAssertEqual(result.map(\.id), ["a"])
    }

    func testIsNilWhenEveryRequestFails() async {
        let result = await fetch([:], ["A"])

        XCTAssertNil(result)
    }

    func testAsksAtMostFiveAccounts() async {
        _ = await fetch([:], (1...8).map { "A\($0)" })

        XCTAssertEqual(StubURLProtocol.requests.count, TransactionsFetcher.maxAccounts)
    }
}
