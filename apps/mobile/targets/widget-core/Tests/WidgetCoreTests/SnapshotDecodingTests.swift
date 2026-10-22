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

// The snapshot is written by the app (snapshot.ts) and read by whatever widget
// build is installed, so decoding must survive both older and newer shapes.
final class SnapshotDecodingTests: XCTestCase {
    private func decode(_ json: String) throws -> WidgetSnapshot {
        try JSONDecoder().decode(WidgetSnapshot.self, from: Data(json.utf8))
    }

    func testDecodesTheShapeTheAppWrites() throws {
        let snapshot = try decode("""
        {
          "version": 1, "locale": "pt-BR", "theme": "dark",
          "network": { "isMainnet": false, "label": "TestNet" },
          "strings": { "updated": "Atualizado" },
          "priceFeed": { "backendUrl": "https://api.test", "apiKey": "k", "currencyCode": "EUR" },
          "portfolioFeed": { "accounts": [{ "address": "A", "name": "Main" }], "period": "one-week" },
          "assetOptions": [{ "assetId": "31566704", "name": "USDC", "unitName": "USDC" }],
          "algoPrice": { "formatted": "€0.19", "asOf": 1727600000000 },
          "portfolio": { "state": "visible", "formatted": null, "algoFormatted": "6,500.12 ALGO", "asOf": 1727600000000 },
          "nfts": { "state": "visible", "items": [{ "assetId": "1", "title": "Art", "imageKey": "1" }] }
        }
        """)

        XCTAssertEqual(snapshot.locale, "pt-BR")
        XCTAssertEqual(snapshot.network?.label, "TestNet")
        XCTAssertEqual(snapshot.string("updated"), "Atualizado")
        XCTAssertEqual(snapshot.portfolioFeed?.accounts.first?.name, "Main")
        XCTAssertEqual(snapshot.assetOptions?.first?.assetId, "31566704")
        XCTAssertNil(snapshot.portfolio?.formatted)
        XCTAssertEqual(snapshot.portfolio?.algoFormatted, "6,500.12 ALGO")
        XCTAssertEqual(snapshot.nfts?.items?.first?.title, "Art")
        XCTAssertEqual(snapshot.algoPrice?.date, Date(timeIntervalSince1970: 1_727_600_000))
    }

    func testDecodesASnapshotWithOnlyAVersion() throws {
        let snapshot = try decode("{ \"version\": 1 }")

        XCTAssertNil(snapshot.priceFeed)
        XCTAssertNil(snapshot.portfolio)
    }

    func testIgnoresFieldsANewerAppAdds() throws {
        let snapshot = try decode("{ \"version\": 1, \"locale\": \"en\", \"futureField\": { \"x\": 1 } }")

        XCTAssertEqual(snapshot.locale, "en")
    }

    func testDecodesPrivacyModeAsHiddenSectionsAndNoFeeds() throws {
        let snapshot = try decode("""
        { "version": 1, "portfolio": { "state": "hidden" }, "nfts": { "state": "hidden" },
          "portfolioFeed": null, "assetOptions": null }
        """)

        XCTAssertEqual(snapshot.portfolio?.state, "hidden")
        XCTAssertNil(snapshot.portfolioFeed)
        XCTAssertNil(snapshot.assetOptions)
    }

    func testDecodesReceiveTargetsAndTheirAbsenceInPrivacyMode() throws {
        let snapshot = try decode("""
        { "version": 1, "receiveTargets": [
            { "address": "ADDR", "name": "Main", "paymentUri": "algorand://ADDR" }
        ] }
        """)
        let hidden = try decode("{ \"version\": 1, \"receiveTargets\": null }")

        XCTAssertEqual(snapshot.receiveTargets?.first?.name, "Main")
        XCTAssertEqual(snapshot.receiveTargets?.first?.paymentUri, "algorand://ADDR")
        XCTAssertNil(hidden.receiveTargets)
    }

    func testDecodesTheInboxFeedWithoutANotificationsBackend() throws {
        let snapshot = try decode("""
        { "version": 1, "inboxFeed": {
            "deviceId": "DEV", "addresses": ["A"],
            "accountNames": [{ "address": "A", "name": "Main" }],
            "notifications": null
        } }
        """)

        XCTAssertEqual(snapshot.inboxFeed?.deviceId, "DEV")
        XCTAssertEqual(snapshot.inboxFeed?.name(of: "A"), "Main")
        XCTAssertNil(snapshot.inboxFeed?.notifications)
    }

    func testDecodesBackupStatusWithCloudNotOffered() throws {
        let snapshot = try decode("""
        { "version": 1, "backup": {
            "cloud": null,
            "passphrase": { "state": "needed", "title": "2 accounts need a backup", "detail": "Tap to back up" }
        } }
        """)

        XCTAssertNil(snapshot.backup?.cloud)
        XCTAssertEqual(snapshot.backup?.passphrase?.state, "needed")
        XCTAssertEqual(snapshot.backup?.passphrase?.title, "2 accounts need a backup")
        XCTAssertEqual(snapshot.backup?.passphrase?.detail, "Tap to back up")
    }
}
