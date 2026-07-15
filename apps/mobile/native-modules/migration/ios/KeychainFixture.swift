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
import Security

enum KeychainFixture {

    static func generate(includeAuthState: Bool) throws {
        if includeAuthState {
            try writePin()
            try writeBiometricFlag()
        }
        try writeAlgo25SecretKey()
        try writeHdWalletSeed()
        try writeHdAddressKeys()
    }

    private static func writePin() throws {
        try write(
            service: LegacyMigrationConstants.KeychainService.tokenPrivate,
            account: LegacyMigrationConstants.KeychainAccount.pinCode,
            data: Data(FixtureIdentities.pinDigits.utf8)
        )
    }

    private static func writeBiometricFlag() throws {
        try write(
            service: LegacyMigrationConstants.KeychainService.tokenPrivate,
            account: LegacyMigrationConstants.KeychainAccount.biometricFlag,
            data: Data("ok".utf8)
        )
    }

    private static func writeAlgo25SecretKey() throws {
        let sk = FixtureIdentities.hexToData(FixtureIdentities.algo25ValidSk64Hex)
        try write(
            service: LegacyMigrationConstants.KeychainService.tokenPrivate,
            account: LegacyMigrationConstants.KeychainAccount.privateKeyPrefix
                + FixtureIdentities.algo25ValidAddress,
            data: sk
        )
    }

    private static func writeHdWalletSeed() throws {
        let entropy = FixtureIdentities.hexToData(FixtureIdentities.hdWalletEntropyHex)
        let envelope: [String: Any] = [
            "id": FixtureIdentities.hdWalletId,
            "entropy": entropy.base64EncodedString(),
        ]
        try write(
            service: LegacyMigrationConstants.KeychainService.hdwallet,
            account: LegacyMigrationConstants.KeychainAccount.hdWalletPrefix
                + FixtureIdentities.hdWalletId,
            data: try JSONSerialization.data(withJSONObject: envelope)
        )
    }

    private static func writeHdAddressKeys() throws {
        let hdKeys: [(address: String, sk64Hex: String)] = [
            (FixtureIdentities.hdKey0Address, FixtureIdentities.hdKey0Sk64Hex),
            (FixtureIdentities.hdKey1Address, FixtureIdentities.hdKey1Sk64Hex),
            (FixtureIdentities.hdKey2Address, FixtureIdentities.hdKey2Sk64Hex),
        ]
        for key in hdKeys {
            let sk = FixtureIdentities.hexToData(key.sk64Hex)
            let publicKey = sk.suffix(32)
            let envelope: [String: Any] = [
                "walletId": FixtureIdentities.hdWalletId,
                "address": key.address,
                "publicKey": Data(publicKey).base64EncodedString(),
                "privateKey": sk.base64EncodedString(),
            ]
            try write(
                service: LegacyMigrationConstants.KeychainService.hdwallet,
                account: LegacyMigrationConstants.KeychainAccount.hdAddressPrefix
                    + FixtureIdentities.hdWalletId + "." + key.address,
                data: try JSONSerialization.data(withJSONObject: envelope)
            )
        }
    }

    private static func write(service: String, account: String, data: Data) throws {
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlocked,
        ]
        let status = SecItemAdd(addQuery as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw LegacyMigrationError.keychain(
                status,
                "SecItemAdd(service=\(service), account=\(account))"
            )
        }
    }
}
