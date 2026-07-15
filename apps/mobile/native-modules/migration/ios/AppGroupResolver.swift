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

final class AppGroupResolver {

    static let shared = AppGroupResolver()

    private let fileManager: FileManager
    private let targetAppGroup: String?
    private var cachedResult: ResolvedContainer??

    struct ResolvedContainer {
        let appGroupId: String
        let containerURL: URL
        let coreDataStoreURL: URL
    }

    init(
        fileManager: FileManager = .default,
        targetAppGroup: String? = AppGroupResolver.defaultTargetAppGroup()
    ) {
        self.fileManager = fileManager
        self.targetAppGroup = targetAppGroup
        self.cachedResult = nil
    }

    static func defaultTargetAppGroup() -> String? {
        guard let bundleId = Bundle.main.bundleIdentifier else { return nil }
        return LegacyMigrationConstants.legacyAppGroupByBundleId[bundleId]
    }

    func resolve() -> ResolvedContainer? {
        if let cached = cachedResult {
            return cached
        }
        let resolved = walk()
        cachedResult = .some(resolved)
        return resolved
    }

    func invalidateCache() {
        cachedResult = nil
    }

    func writableContainer() -> ResolvedContainer? {
        guard let appGroupId = targetAppGroup else { return nil }
        guard let containerURL = fileManager.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        ) else {
            return nil
        }
        let storeURL = containerURL.appendingPathComponent(
            LegacyMigrationConstants.coreDataStoreFilename
        )
        return ResolvedContainer(
            appGroupId: appGroupId,
            containerURL: containerURL,
            coreDataStoreURL: storeURL
        )
    }


    func hasLegacyData() -> Bool {
        resolve() != nil
    }

    private func walk() -> ResolvedContainer? {
        guard let appGroupId = targetAppGroup else { return nil }
        guard let containerURL = fileManager.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        ) else {
            return nil
        }
        let storeURL = containerURL.appendingPathComponent(
            LegacyMigrationConstants.coreDataStoreFilename
        )
        guard isUsableSqliteFile(at: storeURL) else { return nil }
        return ResolvedContainer(
            appGroupId: appGroupId,
            containerURL: containerURL,
            coreDataStoreURL: storeURL
        )
    }

    private func isUsableSqliteFile(at url: URL) -> Bool {
        guard fileManager.fileExists(atPath: url.path) else { return false }
        guard
            let attrs = try? fileManager.attributesOfItem(atPath: url.path),
            let size = (attrs[.size] as? NSNumber)?.intValue
        else {
            return false
        }
        return size > 0
    }
}
