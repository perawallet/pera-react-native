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
import React

@objc(LegacyMigration)
final class LegacyMigrationModule: NSObject {

    private let queue = DispatchQueue(
        label: "com.algorandllc.perarn.migration",
        qos: .userInitiated
    )

    @objc static func requiresMainQueueSetup() -> Bool { false }

    @objc func methodQueue() -> DispatchQueue { queue }

    @objc(hasLegacyData:rejecter:)
    func hasLegacyData(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve(AppGroupResolver.shared.hasLegacyData())
    }

    @objc(getLegacyData:rejecter:)
    func getLegacyData(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        do {
            let payload = try LegacyDataBuilder().build()
            resolve(payload)
        } catch {
            NSLog(
                "[%@] getLegacyData failed: %@",
                LegacyMigrationConstants.logTag,
                error.localizedDescription
            )
            reject(
                LegacyMigrationConstants.ErrorCode.getLegacyData,
                error.localizedDescription,
                error as NSError
            )
        }
    }

    @objc(clearLegacyData:rejecter:)
    func clearLegacyData(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        LegacyDataWiper().clear()
        resolve(NSNull())
    }

    // MARK: - Dev tools (Migration Simulator)

    @objc(getMigrationPlans:rejecter:)
    func getMigrationPlans(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let plan: [String: Any] = [
            "dbName": LegacyMigrationConstants.simulatorStoreName,
            "targetVersion": LegacyMigrationConstants.simulatorVersion,
            "oldestSupported": LegacyMigrationConstants.simulatorVersion,
            "readerImpact":
                "iOS legacy store: Core Data (User blob, contacts, passkeys) + "
                + "Keychain (algo25 / HD keys, PIN, biometric) + App Group "
                + "UserDefaults (preferences). No schema versioning — tolerant "
                + "decode handles every legacy version. Generate writes the full "
                + "fixture set in one call.",
            "migrations": [Any](),
        ]
        resolve([plan])
    }

    /// DEV-ONLY. Writes the full legacy fixture set (Core Data + Keychain + UserDefaults).
    @objc(simulateLegacyDatabase:resolver:rejecter:)
    func simulateLegacyDatabase(
        _ args: NSDictionary,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let dbName = (args["dbName"] as? String) ?? ""
        let version = (args["version"] as? NSNumber)?.intValue
            ?? LegacyMigrationConstants.simulatorVersion
        let includeUnroutable =
            (args["includeUnroutableAccounts"] as? NSNumber)?.boolValue ?? false
        let includeAuthState =
            (args["includeAuthState"] as? NSNumber)?.boolValue ?? false
        do {
            try MigrationSimulator.generate(
                dbName: dbName,
                version: version,
                includeUnroutable: includeUnroutable,
                includeAuthState: includeAuthState
            )
            resolve(NSNull())
        } catch {
            NSLog(
                "[%@] simulateLegacyDatabase failed: %@",
                LegacyMigrationConstants.logTag,
                error.localizedDescription
            )
            reject(
                LegacyMigrationConstants.ErrorCode.simulate,
                error.localizedDescription,
                error as NSError
            )
        }
    }

    /// DEV-ONLY. Destructive wipe of every legacy artifact (Core Data store + WAL/SHM, App Group UserDefaults, Keychain entries).
    @objc(resetLegacyData:rejecter:)
    func resetLegacyData(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        LegacyDataWiper().forceClear()
        resolve(NSNull())
    }
}
