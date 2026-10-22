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

final class InboxFetcherTests: XCTestCase {
    override func tearDown() {
        StubURLProtocol.uninstall()
        super.tearDown()
    }

    private let feed = WidgetSnapshot.InboxFeed(
        deviceId: "DEV",
        addresses: ["MAIN", "SAVINGS"],
        accountNames: [.init(address: "VAULT", name: "Team Vault")],
        notifications: .init(backendUrl: "https://notify.test", deviceId: "NDEV")
    )

    private func signRequest(_ id: String, _ status: String, _ created: String) -> String {
        """
        { "id": \(id), "status": "\(status)", "creation_datetime": "\(created)",
          "joint_account": { "address": "VAULT", "creation_datetime": "2026-10-01T10:00:00Z" } }
        """
    }

    private func inbox(signs: [String] = [], invites: [String] = [], assets: [String] = []) -> StubURLProtocol.Response {
        ok("""
        { "joint_account_import_requests": [\(invites.joined(separator: ","))],
          "joint_account_sign_requests": [\(signs.joined(separator: ","))],
          "asa_inboxes": [\(assets.joined(separator: ","))] }
        """)
    }

    private func bodyJSON(_ request: URLRequest) throws -> [String: [String]] {
        // URLProtocol sees the body as a stream, not `httpBody`.
        let stream = try XCTUnwrap(request.httpBodyStream)
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1024)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: buffer.count)
            guard read > 0 else { break }
            data.append(buffer, count: read)
        }
        return try JSONDecoder().decode([String: [String]].self, from: data)
    }

    func testPostsTheAccountsAndKeepsOnlyWhatStillNeedsTheUser() async throws {
        StubURLProtocol.install(["/v1/inbox/DEV/": inbox(
            signs: [
                signRequest("7", "pending", "2026-10-20T10:00:00.123456Z"),
                signRequest("8", "confirmed", "2026-10-21T10:00:00Z"),
            ],
            invites: ["{ \"address\": \"TREASURY\", \"creation_datetime\": \"2026-10-21T09:00:00Z\" }"],
            assets: [
                "{ \"address\": \"MAIN\", \"inbox_address\": null, \"request_count\": 2 }",
                "{ \"address\": \"SAVINGS\", \"inbox_address\": null, \"request_count\": 0 }",
            ]
        )])

        let fetched = await InboxFetcher.fetch(feed, testFeed)
        let summary = try XCTUnwrap(fetched)

        // Newest dated first, undated asset rows last; the confirmed request and
        // the empty asset inbox are gone.
        XCTAssertEqual(summary.items.map(\.id), ["invite-TREASURY", "sign-7", "assets-MAIN"])
        XCTAssertEqual(summary.signatures.first?.signRequestId, "7")
        XCTAssertEqual(summary.assetCount, 2)
        XCTAssertEqual(summary.inviteCount, 1)
        XCTAssertEqual(summary.total, 4)

        let request = try XCTUnwrap(StubURLProtocol.requests.first)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-API-Key"), "test-key")
        XCTAssertEqual(try bodyJSON(request), ["addresses": ["MAIN", "SAVINGS"]])
    }

    func testAnEmptyInboxIsZeroNotAFailure() async throws {
        StubURLProtocol.install(["/v1/inbox/DEV/": inbox()])

        let fetched = await InboxFetcher.fetch(feed, testFeed)

        XCTAssertEqual(try XCTUnwrap(fetched).total, 0)
    }

    func testAFailedRequestIsNil() async {
        StubURLProtocol.install([:])

        let fetched = await InboxFetcher.fetch(feed, testFeed)

        XCTAssertNil(fetched)
    }

    func testNotificationsKeepTheNewestWithAMessage() async throws {
        StubURLProtocol.install(["/v2/devices/NDEV/notifications/": ok("""
        { "results": [
            { "id": 1, "message": "You received 25 ALGO", "creation_datetime": "2026-10-21T10:00:00Z", "is_unread": true },
            { "id": "2", "message": "", "creation_datetime": "2026-10-21T09:00:00Z" },
            { "id": 3, "message": "Swap completed", "creation_datetime": "2026-10-20T10:00:00.5Z" },
            { "id": 4, "message": "Beyond the limit", "creation_datetime": "2026-10-19T10:00:00Z" }
        ], "next": null, "previous": null }
        """)])

        let notifications = try XCTUnwrap(feed.notifications)
        let fetched = await InboxFetcher.notifications(notifications, apiKey: "test-key", limit: 3)
        let rows = try XCTUnwrap(fetched)

        XCTAssertEqual(rows.map(\.id), ["1", "3"])
        XCTAssertEqual(rows.map(\.isUnread), [true, false])
        XCTAssertEqual(StubURLProtocol.requests.first?.httpMethod, "GET")
    }

    func testNamesComeFromTheAppsAccounts() {
        XCTAssertEqual(feed.name(of: "VAULT"), "Team Vault")
        XCTAssertNil(feed.name(of: "UNKNOWN"))
    }

    func testDatesParseWithAndWithoutFractions() {
        XCTAssertNotNil(ISODate.parse("2026-10-20T10:00:00Z"))
        XCTAssertNotNil(ISODate.parse("2026-10-20T10:00:00.123456Z"))
        XCTAssertNotNil(ISODate.parse("2026-10-20T10:00:00.123456+00:00"))
        XCTAssertNil(ISODate.parse("not a date"))
    }
}
