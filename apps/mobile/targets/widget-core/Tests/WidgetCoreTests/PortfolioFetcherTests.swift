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

final class PortfolioFetcherTests: XCTestCase {
    override func tearDown() {
        StubURLProtocol.uninstall()
        super.tearDown()
    }

    private let history = ok("""
    { "results": [
        { "usd_value": "100", "algo_value": "500" },
        { "usd_value": "120", "algo_value": "600" }
    ] }
    """)

    // The wealth endpoint's last point is the current total.
    func testUsesTheLastPointAsTheCurrentValue() async throws {
        StubURLProtocol.install(["/v1/wallet/wealth/": history, "/v1/currencies/EUR/": ok("{ \"usd_value\": \"0.5\" }")])

        let fetched = await PortfolioFetcher.fetch(addresses: ["A"], period: "one-week", testFeed)
        let quote = try XCTUnwrap(fetched)

        XCTAssertEqual(quote.algo, 600)
        XCTAssertEqual(quote.fiat, 60)
        XCTAssertEqual(quote.chart, [500, 600])
        XCTAssertEqual(quote.change ?? 0, 0.2, accuracy: 1e-9)
    }

    func testKeepsTheALGOValueWhenTheRateIsUnknown() async throws {
        StubURLProtocol.install(["/v1/wallet/wealth/": history])

        let fetched = await PortfolioFetcher.fetch(addresses: ["A"], period: "one-week", testFeed)
        let quote = try XCTUnwrap(fetched)

        XCTAssertEqual(quote.algo, 600)
        XCTAssertNil(quote.fiat)
    }

    func testSendsCommaJoinedAddressesAndThePeriod() async throws {
        StubURLProtocol.install(["/v1/wallet/wealth/": history])

        _ = await PortfolioFetcher.fetch(addresses: ["A", "B"], period: "one-day", testFeed)

        let request = try XCTUnwrap(StubURLProtocol.requests.first { $0.url?.path == "/v1/wallet/wealth/" })
        let items = URLComponents(url: try XCTUnwrap(request.url), resolvingAgainstBaseURL: false)?.queryItems ?? []
        XCTAssertEqual(items.first { $0.name == "account_addresses" }?.value, "A,B")
        XCTAssertEqual(items.first { $0.name == "period" }?.value, "one-day")
    }

    func testMakesNoRequestWithoutAddresses() async {
        StubURLProtocol.install([:])

        let quote = await PortfolioFetcher.fetch(addresses: [], period: "one-week", testFeed)

        XCTAssertNil(quote)
        XCTAssertTrue(StubURLProtocol.requests.isEmpty)
    }

    func testFailsWhenTheHistoryIsEmpty() async {
        StubURLProtocol.install(["/v1/wallet/wealth/": ok("{ \"results\": [] }")])

        let quote = await PortfolioFetcher.fetch(addresses: ["A"], period: "one-week", testFeed)

        XCTAssertNil(quote)
    }
}
