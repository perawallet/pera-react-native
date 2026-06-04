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
import Security

/// DESTRUCTIVE: removes every legacy artifact (Core Data store + WAL/SHM, App Group UserDefaults, all legacy-service Keychain entries).
final class LegacyDataWiper {

    /// DEV-ONLY destructive wipe. Runs the full wipe unconditionally.
    func forceClear() {
        performClear()
    }

    private func performClear() {
        let log = LegacyMigrationConstants.logTag
        NSLog("[%@] clear() begin", log)
        wipeAppGroupContainer()
        wipeUserDefaults()
        wipeKeychain()
        AppGroupResolver.shared.invalidateCache()
        NSLog("[%@] clear() complete", log)
    }

    private func wipeAppGroupContainer() {
        guard let resolved = AppGroupResolver.shared.resolve() else {
            return
        }
        let fm = FileManager.default
        let storeBase = resolved.containerURL.appendingPathComponent(
            LegacyMigrationConstants.coreDataStoreFilename
        )
        // SQLite gotcha: delete WAL/SHM before the main DB or journals can replay into a fresh store.
        for suffix in ["-wal", "-shm", ""] {
            let url = URL(fileURLWithPath: storeBase.path + suffix)
            guard fm.fileExists(atPath: url.path) else { continue }
            do {
                try fm.removeItem(at: url)
            } catch {
                NSLog(
                    "[%@] failed to delete %@: %@",
                    LegacyMigrationConstants.logTag,
                    url.lastPathComponent,
                    error.localizedDescription
                )
            }
        }
    }

    private func wipeUserDefaults() {
        guard let resolved = AppGroupResolver.shared.resolve() else {
            return
        }
        guard let defaults = UserDefaults(suiteName: resolved.appGroupId) else {
            return
        }
        defaults.removePersistentDomain(forName: resolved.appGroupId)
    }

    private func wipeKeychain() {
        // Security gate: only wipe Keychain groups whose suffix matches this build's bundle id, or it would nuke other variants' (prod/beta) legacy Keychain items.
        guard let bundleId = Bundle.main.bundleIdentifier else { return }
        let variantSuffix = "." + bundleId

        let services = [
            LegacyMigrationConstants.KeychainService.tokenPrivate,
            LegacyMigrationConstants.KeychainService.hdwallet,
            LegacyMigrationConstants.KeychainService.biometricStorage,
        ]
        for service in services {
            wipeKeychainService(service, variantSuffix: variantSuffix)
        }
    }

    private func wipeKeychainService(_ service: String, variantSuffix: String) {
        let findQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecMatchLimit as String: kSecMatchLimitAll,
            kSecReturnAttributes as String: true,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(findQuery as CFDictionary, &result)
        if status == errSecItemNotFound {
            return
        }
        guard status == errSecSuccess, let items = result as? [[String: Any]] else {
            NSLog(
                "[%@] SecItemCopyMatching failed: service=%@ status=%d",
                LegacyMigrationConstants.logTag,
                service,
                status
            )
            return
        }
        for item in items {
            guard
                let account = item[kSecAttrAccount as String] as? String,
                let accessGroup = item[kSecAttrAccessGroup as String] as? String,
                accessGroup.hasSuffix(variantSuffix)
            else { continue }
            let deleteQuery: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: account,
                kSecAttrAccessGroup as String: accessGroup,
            ]
            let deleteStatus = SecItemDelete(deleteQuery as CFDictionary)
            if deleteStatus != errSecSuccess && deleteStatus != errSecItemNotFound {
                NSLog(
                    "[%@] SecItemDelete failed: service=%@ account=%@ group=%@ status=%d",
                    LegacyMigrationConstants.logTag,
                    service,
                    account,
                    accessGroup,
                    deleteStatus
                )
            }
        }
    }
}
