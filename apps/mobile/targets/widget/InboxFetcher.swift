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

/// Something in the inbox waiting for the user.
struct InboxItem: Identifiable, Equatable {
    enum Kind: Equatable {
        /// A shared account transaction waiting for a signature.
        case sign
        /// Assets waiting in an account's ARC-59 inbox.
        case assets
        /// An invitation to join a shared account.
        case invite
    }

    let id: String
    let kind: Kind
    /// The shared account for `sign` and `invite`; the receiving account for `assets`.
    let address: String
    /// Incoming assets for `assets`; 1 otherwise.
    let count: Int
    /// Nil for `assets`, which the inbox doesn't date.
    let date: Date?
    /// Set for `sign`: opens that request in the app.
    let signRequestId: String?
}

struct InboxSummary: Equatable {
    /// Newest first; undated asset rows last.
    let items: [InboxItem]
    let fetchedAt: Date

    var signatures: [InboxItem] { items.filter { $0.kind == .sign } }
    var assetCount: Int { items.filter { $0.kind == .assets }.reduce(0) { $0 + $1.count } }
    var inviteCount: Int { items.filter { $0.kind == .invite }.count }
    var total: Int { items.reduce(0) { $0 + $1.count } }
}

struct NotificationRow: Identifiable, Equatable {
    let id: String
    let message: String
    let date: Date
    let isUnread: Bool
}

enum InboxFetcher {
    /// The same request the app's inbox makes; nil when it fails.
    static func fetch(_ inbox: WidgetSnapshot.InboxFeed, _ feed: WidgetSnapshot.PriceFeed) async -> InboxSummary? {
        guard let base = URL(string: feed.backendUrl) else { return nil }
        let response: InboxResponse? = await PriceFetcher.post(
            base,
            "v1/inbox/\(inbox.deviceId)/",
            apiKey: feed.apiKey,
            body: ["addresses": inbox.addresses]
        )
        guard let response else { return nil }
        return InboxSummary(items: items(response), fetchedAt: .now)
    }

    /// The newest `limit` notifications; nil when the request fails.
    static func notifications(
        _ notifications: WidgetSnapshot.InboxFeed.Notifications,
        apiKey: String,
        limit: Int
    ) async -> [NotificationRow]? {
        guard let base = URL(string: notifications.backendUrl) else { return nil }
        let response: NotificationsResponse? = await PriceFetcher.send(
            base,
            "v2/devices/\(notifications.deviceId)/notifications/",
            apiKey: apiKey,
            body: nil
        )
        guard let response else { return nil }
        return response.results.prefix(limit).compactMap { item in
            guard let message = item.message, !message.isEmpty,
                  let date = ISODate.parse(item.creation_datetime)
            else { return nil }
            return NotificationRow(id: item.id.value, message: message, date: date, isUnread: item.is_unread ?? false)
        }
    }

    // Only requests that still need something from the user: a sign request
    // that has every signature, or has failed or expired, is history.
    static func items(_ response: InboxResponse) -> [InboxItem] {
        let signs = response.joint_account_sign_requests
            .filter { $0.status == "pending" }
            .map {
                InboxItem(
                    id: "sign-\($0.id.value)", kind: .sign, address: $0.joint_account.address, count: 1,
                    date: ISODate.parse($0.creation_datetime), signRequestId: $0.id.value
                )
            }
        let invites = response.joint_account_import_requests.map {
            InboxItem(
                id: "invite-\($0.address)", kind: .invite, address: $0.address, count: 1,
                date: ISODate.parse($0.creation_datetime), signRequestId: nil
            )
        }
        let assets = response.asa_inboxes
            .filter { $0.request_count > 0 }
            .map {
                InboxItem(
                    id: "assets-\($0.address)", kind: .assets, address: $0.address, count: $0.request_count,
                    date: nil, signRequestId: nil
                )
            }
        let dated = (signs + invites).sorted { ($0.date ?? .distantPast) > ($1.date ?? .distantPast) }
        return dated + assets
    }

    struct InboxResponse: Decodable {
        let joint_account_import_requests: [Account]
        let joint_account_sign_requests: [SignRequest]
        let asa_inboxes: [AssetInbox]
    }

    struct Account: Decodable {
        let address: String
        let creation_datetime: String?
    }

    struct SignRequest: Decodable {
        let id: LooseString
        let status: String
        let creation_datetime: String?
        let joint_account: Account
    }

    struct AssetInbox: Decodable {
        let address: String
        let request_count: Int
    }

    private struct NotificationsResponse: Decodable {
        let results: [Notification]
    }

    private struct Notification: Decodable {
        let id: LooseString
        let message: String?
        let creation_datetime: String?
        let is_unread: Bool?
    }
}

/// An id the backend sends as either a string or a number.
struct LooseString: Decodable, Equatable {
    let value: String

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            value = string
        } else {
            value = String(try container.decode(Int.self))
        }
    }
}

enum ISODate {
    private static let withFraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let plain = ISO8601DateFormatter()

    /// The backend writes microseconds on some rows and none on others, and
    /// the formatter doesn't take every fraction length, so a last attempt
    /// drops the fraction.
    static func parse(_ value: String?) -> Date? {
        guard let value else { return nil }
        if let date = withFraction.date(from: value) ?? plain.date(from: value) { return date }
        let trimmed = value.replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression)
        return plain.date(from: trimmed)
    }
}
