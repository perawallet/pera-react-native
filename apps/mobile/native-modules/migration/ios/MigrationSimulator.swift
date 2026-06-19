/*
 Copyright 2022-2025 Pera Wallet, LDA
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

/// DEV-ONLY orchestrator for the iOS Migration Simulator: materializes a full legacy on-device state (Core Data + Keychain + UserDefaults).
enum MigrationSimulator {

    static func generate(
        dbName: String,
        version: Int,
        includeUnroutable: Bool,
        includeAuthState: Bool
    ) throws {
        guard dbName == LegacyMigrationConstants.simulatorStoreName else {
            throw LegacyMigrationError.simulator(
                "unknown dbName '\(dbName)' (expected '\(LegacyMigrationConstants.simulatorStoreName)')"
            )
        }

        guard let container = AppGroupResolver.shared.writableContainer() else {
            throw LegacyMigrationError.simulator(
                "App Group container could not be resolved. Build with "
                    + "PERA_BUNDLE_IDS=legacy so the legacy App Group + Keychain "
                    + "entitlements are present."
            )
        }

        deleteStoreFiles(at: container.coreDataStoreURL)

        do {
            try CoreDataStoreFixture.write(
                to: container.coreDataStoreURL,
                includeUnroutable: includeUnroutable
            )
            try KeychainFixture.generate(includeAuthState: includeAuthState)
            UserDefaultsFixture.generate(
                suiteName: container.appGroupId,
                includeAuthState: includeAuthState
            )
        } catch {
            deleteStoreFiles(at: container.coreDataStoreURL)
            throw error
        }

        AppGroupResolver.shared.invalidateCache()
    }

    private static func deleteStoreFiles(at storeURL: URL) {
        let fileManager = FileManager.default
        for suffix in ["-wal", "-shm", "-journal", ""] {
            let url = URL(fileURLWithPath: storeURL.path + suffix)
            if fileManager.fileExists(atPath: url.path) {
                try? fileManager.removeItem(at: url)
            }
        }
    }
}
