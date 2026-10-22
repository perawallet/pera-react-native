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

// Mirrors widgetSnapshotSchema in the app's widgets module (snapshot.ts). Every
// field after `version` is optional so an older widget still decodes a newer
// snapshot. Compiled into every target, including the iOS 16.4 app: keep it
// free of WidgetKit and iOS 17 APIs.
struct WidgetSnapshot: Codable {
    struct Network: Codable {
        let isMainnet: Bool
        let label: String
    }

    /// Where the widget can refresh the ALGO price on its own.
    struct PriceFeed: Codable {
        let backendUrl: String
        let apiKey: String
        let currencyCode: String
    }

    /// Lets the widget refresh balances and the chart itself. Never rendered.
    struct PortfolioFeed: Codable {
        struct Account: Codable {
            let address: String
            /// The name the app shows for the account; labels the account option.
            let name: String
        }

        let accounts: [Account]
        /// one-day | one-week | one-month | one-year, the app's chart period.
        let period: String
    }

    /// A verified asset the user holds, offered by the price widget's asset option.
    struct AssetOption: Codable {
        let assetId: String
        let name: String
        let unitName: String
    }

    struct Price: Codable {
        let formatted: String
        /// Epoch milliseconds.
        let asOf: Double
    }

    struct Portfolio: Codable {
        let state: String
        let formatted: String?
        let algoFormatted: String?
        let asOf: Double?
    }

    struct Nft: Codable, Hashable {
        let assetId: String
        let title: String
        let collectionName: String?
        let imageKey: String
    }

    struct Nfts: Codable {
        let state: String
        let items: [Nft]?
    }

    /// Ready-to-show backup status; the app owns the wording, plurals and dates.
    struct Backup: Codable {
        struct Line: Codable {
            /// cloud: notSetUp | partial | failed | backedUp. passphrase: needed | backedUp.
            let state: String
            let title: String
            let detail: String?
        }

        /// Nil where cloud backup isn't offered.
        let cloud: Line?
        let passphrase: Line?
    }

    /// Lets the inbox widgets fetch requests and notifications themselves.
    /// Device ids and addresses are never rendered.
    struct InboxFeed: Codable {
        struct AccountName: Codable {
            let address: String
            let name: String
        }

        struct Notifications: Codable {
            let backendUrl: String
            let deviceId: String
        }

        let deviceId: String
        let addresses: [String]
        let accountNames: [AccountName]
        /// Nil where the deployment has no notifications backend.
        let notifications: Notifications?

        func name(of address: String) -> String? {
            accountNames.first { $0.address == address }?.name
        }
    }

    /// An account the Receive QR widget can show. The only address a widget renders.
    struct ReceiveTarget: Codable {
        let address: String
        let name: String
        /// What the QR encodes, as on the app's Receive screen.
        let paymentUri: String
        /// CAIP-2 id of the account's receive network; nil on a custom network.
        let chain: String?
    }

    let version: Int
    let locale: String?
    let theme: String?
    let network: Network?
    let strings: [String: String]?
    let priceFeed: PriceFeed?
    let portfolioFeed: PortfolioFeed?
    let assetOptions: [AssetOption]?
    let algoPrice: Price?
    let portfolio: Portfolio?
    let nfts: Nfts?
    let backup: Backup?
    let receiveTargets: [ReceiveTarget]?
    let inboxFeed: InboxFeed?

    func string(_ key: String) -> String? { strings?[key] }
}

extension WidgetSnapshot.Price {
    var date: Date { Date(timeIntervalSince1970: asOf / 1000) }
}

enum SnapshotStore {
    static let supportedVersion = 1

    // Keys are written by the PeraWidgets native module; change both together.
    private static let snapshotKey = "pera.widgets.snapshot"
    private static let imagesFolder = "widgets"
    private static let extensionSuffix = ".widget"

    // The app's Info.plist names the group (written by the passkey-autofill
    // plugin). An extension's Info.plist is the same for every app variant, so
    // there the group is derived from the bundle id: <app id>.widget -> group.<app id>.
    static var appGroup: String? {
        if let group = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String {
            return group
        }
        guard let id = Bundle.main.bundleIdentifier, id.hasSuffix(extensionSuffix) else { return nil }
        return "group." + id.dropLast(extensionSuffix.count)
    }

    // Read and cleared by the PeraWidgets native module's consumePendingScan,
    // which also observes the notification; change both together.
    private static let pendingScanKey = "pera.widgets.pendingScan"
    private static let scanRequestedNotification = "app.perawallet.widgets.scanRequested"

    /// Records that the Scan control asked for the scanner (epoch seconds), then
    /// notifies a running app, which may already be active by the time this runs.
    static func requestScan() {
        UserDefaults(suiteName: appGroup ?? "")?.set(Date().timeIntervalSince1970, forKey: pendingScanKey)
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(scanRequestedNotification as CFString),
            nil, nil, true
        )
    }

    static func load() -> WidgetSnapshot? {
        guard let group = appGroup,
              let json = UserDefaults(suiteName: group)?.string(forKey: snapshotKey),
              let data = json.data(using: .utf8),
              let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data),
              snapshot.version == supportedVersion
        else { return nil }
        return snapshot
    }

    static func imageURL(forKey key: String) -> URL? {
        guard let group = appGroup,
              let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
        else { return nil }
        let url = container.appendingPathComponent(imagesFolder).appendingPathComponent("nft-\(key).jpg")
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }
}
