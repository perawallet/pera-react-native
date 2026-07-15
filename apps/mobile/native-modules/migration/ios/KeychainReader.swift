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

final class KeychainReader {

    func readPin() throws -> Data? {
        try readGeneric(
            service: LegacyMigrationConstants.KeychainService.tokenPrivate,
            account: LegacyMigrationConstants.KeychainAccount.pinCode
        )
    }

    func readBiometricEnabled() throws -> Bool {
        let data = try readGeneric(
            service: LegacyMigrationConstants.KeychainService.tokenPrivate,
            account: LegacyMigrationConstants.KeychainAccount.biometricFlag
        )
        return data != nil
    }

    func readAccountSecretKey(for address: String) throws -> Data? {
        let account = LegacyMigrationConstants.KeychainAccount.privateKeyPrefix + address
        return try readGeneric(
            service: LegacyMigrationConstants.KeychainService.tokenPrivate,
            account: account
        )
    }

    struct HDWalletSeedJSON: Decodable {
        let id: String
        let entropy: String
    }

    struct HDWalletAddressJSON: Decodable {
        let walletId: String
        let address: String
        let publicKey: String?
        let privateKey: String?
    }

    func readHDWalletSeed(walletId: String) throws -> HDWalletSeedJSON? {
        let account = LegacyMigrationConstants.KeychainAccount.hdWalletPrefix + walletId
        guard let data = try readGeneric(
            service: LegacyMigrationConstants.KeychainService.hdwallet,
            account: account
        ) else { return nil }
        return try decodeJSON(data, as: HDWalletSeedJSON.self, context: "hdwallet seed \(walletId)")
    }

    func readHDAddress(walletId: String, address: String) throws -> HDWalletAddressJSON? {
        let account = LegacyMigrationConstants.KeychainAccount.hdAddressPrefix
            + walletId + "." + address
        guard let data = try readGeneric(
            service: LegacyMigrationConstants.KeychainService.hdwallet,
            account: account
        ) else { return nil }
        return try decodeJSON(data, as: HDWalletAddressJSON.self, context: "hdwallet address \(address)")
    }

    private func readGeneric(service: String, account: String) throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess else {
            throw LegacyMigrationError.keychain(
                status,
                "SecItemCopyMatching(service=\(service), account=\(account))"
            )
        }
        return result as? Data
    }

    private func decodeJSON<T: Decodable>(
        _ data: Data,
        as type: T.Type,
        context: String
    ) throws -> T {
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw LegacyMigrationError.decode(
                "JSONDecoder failed for \(context): \(error.localizedDescription)"
            )
        }
    }
}
