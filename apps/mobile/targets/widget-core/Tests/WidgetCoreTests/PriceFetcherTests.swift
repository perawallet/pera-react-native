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

final class PriceFetcherTests: XCTestCase {
    override func tearDown() {
        StubURLProtocol.uninstall()
        super.tearDown()
    }

    private func asset(_ id: String, tier: String?, usd: String, previous: String? = nil, unit: String = "USDC") -> (String, StubURLProtocol.Response) {
        let tierField = tier.map { "\"verification_tier\": \"\($0)\"," } ?? ""
        let previousField = previous.map { "\"usd_value_24_hour_ago\": \"\($0)\"," } ?? ""
        return ("/v1/public/assets/\(id)/", ok("{ \(tierField) \(previousField) \"unit_name\": \"\(unit)\", \"usd_value\": \"\(usd)\" }"))
    }

    func testPricesAVerifiedAssetInTheChosenFiatCurrency() async throws {
        let (path, body) = asset("31566704", tier: "verified", usd: "1.0", previous: "0.98")
        StubURLProtocol.install([
            path: body,
            "/v1/currencies/EUR/": ok("{ \"usd_value\": \"0.9\" }"),
            "/v1/assets/price-chart/": ok("[{ \"price\": 1.0 }, { \"price\": 1.01 }]"),
        ])

        let fetched = await PriceFetcher.fetch(testFeed, assetId: "31566704", quote: .fiat("EUR"), period: "one-week")
        let quote = try XCTUnwrap(fetched)

        XCTAssertEqual(quote.price, Decimal(string: "0.9"))
        XCTAssertEqual(quote.unitName, "USDC")
        XCTAssertEqual(quote.change24h ?? 0, (1.0 - 0.98) / 0.98, accuracy: 1e-9)
        XCTAssertEqual(quote.chart.count, 2)
        XCTAssertEqual(quote.chart[1], 1.01 * 0.9, accuracy: 1e-9)
    }

    // The spoofing guard: a look-alike asset must never get a home-screen price.
    func testRejectsAnUnverifiedAsset() async {
        let (path, body) = asset("999", tier: "unverified", usd: "1.0")
        StubURLProtocol.install([path: body, "/v1/currencies/EUR/": ok("{ \"usd_value\": \"0.9\" }")])

        let quote = await PriceFetcher.fetch(testFeed, assetId: "999", quote: .fiat("EUR"), period: "one-week")

        XCTAssertNil(quote)
    }

    func testRejectsASuspiciousAsset() async {
        let (path, body) = asset("999", tier: "suspicious", usd: "1.0")
        StubURLProtocol.install([path: body, "/v1/currencies/EUR/": ok("{ \"usd_value\": \"0.9\" }")])

        let quote = await PriceFetcher.fetch(testFeed, assetId: "999", quote: .fiat("EUR"), period: "one-week")

        XCTAssertNil(quote)
    }

    func testRejectsAnAssetWithNoTier() async {
        let (path, body) = asset("999", tier: nil, usd: "1.0")
        StubURLProtocol.install([path: body, "/v1/currencies/EUR/": ok("{ \"usd_value\": \"0.9\" }")])

        let quote = await PriceFetcher.fetch(testFeed, assetId: "999", quote: .fiat("EUR"), period: "one-week")

        XCTAssertNil(quote)
    }

    func testAcceptsATrustedAsset() async {
        let (path, body) = asset("31566704", tier: "trusted", usd: "1.0")
        StubURLProtocol.install([path: body, "/v1/currencies/EUR/": ok("{ \"usd_value\": \"0.9\" }")])

        let quote = await PriceFetcher.fetch(testFeed, assetId: "31566704", quote: .fiat("EUR"), period: "one-week")

        XCTAssertNotNil(quote)
    }

    func testPricesALGOWithoutRequiringATier() async throws {
        let (path, body) = asset("0", tier: nil, usd: "0.2", unit: "")
        StubURLProtocol.install([path: body, "/v1/currencies/EUR/": ok("{ \"usd_value\": \"0.9\" }")])

        let fetched = await PriceFetcher.fetch(testFeed, assetId: "0", quote: .fiat("EUR"), period: "one-week")
        let quote = try XCTUnwrap(fetched)

        XCTAssertEqual(quote.unitName, "ALGO")
        XCTAssertEqual(quote.price, Decimal(string: "0.18"))
    }

    func testQuotesInALGOByDividingByTheALGOPrice() async throws {
        let (usdcPath, usdcBody) = asset("31566704", tier: "verified", usd: "1.0")
        let (algoPath, algoBody) = asset("0", tier: nil, usd: "0.2", unit: "")
        StubURLProtocol.install([usdcPath: usdcBody, algoPath: algoBody])

        let fetched = await PriceFetcher.fetch(testFeed, assetId: "31566704", quote: .algo, period: "one-week")
        let quote = try XCTUnwrap(fetched)

        XCTAssertEqual(quote.price, 5)
        XCTAssertEqual(quote.quote, .algo)
    }

    func testMakesNoCurrencyRequestForUSD() async {
        let (path, body) = asset("0", tier: nil, usd: "0.2", unit: "")
        StubURLProtocol.install([path: body])

        _ = await PriceFetcher.fetch(testFeed, assetId: "0", quote: .fiat("USD"), period: "one-week")

        XCTAssertFalse(StubURLProtocol.requests.contains { $0.url?.path.hasPrefix("/v1/currencies/") == true })
    }

    func testHasNoChangeWhenThePreviousPriceIsZero() async throws {
        let (path, body) = asset("0", tier: nil, usd: "0.2", previous: "0", unit: "")
        StubURLProtocol.install([path: body])

        let fetched = await PriceFetcher.fetch(testFeed, assetId: "0", quote: .fiat("USD"), period: "one-week")
        let quote = try XCTUnwrap(fetched)

        XCTAssertNil(quote.change24h)
    }

    func testStillPricesWhenTheChartFails() async throws {
        let (path, body) = asset("0", tier: nil, usd: "0.2", unit: "")
        StubURLProtocol.install([path: body, "/v1/assets/price-chart/": .init(status: 500, body: "")])

        let fetched = await PriceFetcher.fetch(testFeed, assetId: "0", quote: .fiat("USD"), period: "one-week")
        let quote = try XCTUnwrap(fetched)

        XCTAssertEqual(quote.chart, [])
    }

    func testFailsWithoutACurrencyRate() async {
        let (path, body) = asset("0", tier: nil, usd: "0.2", unit: "")
        StubURLProtocol.install([path: body])

        let quote = await PriceFetcher.fetch(testFeed, assetId: "0", quote: .fiat("EUR"), period: "one-week")

        XCTAssertNil(quote)
    }

    func testSendsTheAPIKeyAndChartPeriod() async {
        let (path, body) = asset("0", tier: nil, usd: "0.2", unit: "")
        StubURLProtocol.install([path: body])

        _ = await PriceFetcher.fetch(testFeed, assetId: "0", quote: .fiat("USD"), period: "one-month")

        let requests = StubURLProtocol.requests
        XCTAssertTrue(requests.allSatisfy { $0.value(forHTTPHeaderField: "X-API-Key") == "test-key" })
        XCTAssertTrue(requests.contains { $0.url?.query?.contains("period=one-month") == true })
    }
}
