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

    let version: Int
    let locale: String?
    let theme: String?
    let network: Network?
    let strings: [String: String]?
    let algoPrice: Price?
    let portfolio: Portfolio?
    let nfts: Nfts?

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

    // An extension's Info.plist is the same for every app variant, so the group
    // is derived from the bundle id: <app id>.widget -> group.<app id>.
    static var appGroup: String? {
        guard let id = Bundle.main.bundleIdentifier, id.hasSuffix(extensionSuffix) else { return nil }
        return "group." + id.dropLast(extensionSuffix.count)
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

    static var cachedImageCount: Int {
        guard let group = appGroup,
              let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
        else { return 0 }
        let folder = container.appendingPathComponent(imagesFolder)
        return (try? FileManager.default.contentsOfDirectory(atPath: folder.path).count) ?? 0
    }
}
