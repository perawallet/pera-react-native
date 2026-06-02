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

enum HdWalletsBuilder {

    static func compose(
        accounts: [LegacyUserBlob.LegacyAccountInfo],
        walletNames: [String: String],
        keychain: KeychainReader
    ) -> [Any] {
        groupAccountsByWalletId(accounts).map { walletId, walletAccounts in
            composeWallet(
                walletId: walletId,
                accounts: walletAccounts,
                walletNames: walletNames,
                keychain: keychain
            )
        }
    }

    private static func groupAccountsByWalletId(
        _ accounts: [LegacyUserBlob.LegacyAccountInfo]
    ) -> [String: [LegacyUserBlob.LegacyAccountInfo]] {
        var groups: [String: [LegacyUserBlob.LegacyAccountInfo]] = [:]
        for account in accounts {
            guard let walletId = account.hdWalletAddressDetail?.walletId else { continue }
            groups[walletId, default: []].append(account)
        }
        return groups
    }

    private static func composeWallet(
        walletId: String,
        accounts: [LegacyUserBlob.LegacyAccountInfo],
        walletNames: [String: String],
        keychain: KeychainReader
    ) -> [String: Any] {
        var m = BridgeMap()
        m.putString("walletId", walletId)
        m.putString("name", walletNames[walletId])
        m.putBytes("entropy", readWalletEntropy(walletId: walletId, keychain: keychain))
        m.putRaw("keys", accounts.map {
            composeKey(account: $0, walletId: walletId, keychain: keychain)
        })
        return m.dict
    }

    private static func composeKey(
        account: LegacyUserBlob.LegacyAccountInfo,
        walletId: String,
        keychain: KeychainReader
    ) -> [String: Any] {
        var k = BridgeMap()
        k.putString("address", account.address)
        k.putInt("account", account.hdWalletAddressDetail?.account ?? 0)
        k.putInt("change", account.hdWalletAddressDetail?.change ?? 0)
        k.putInt("keyIndex", account.hdWalletAddressDetail?.keyIndex ?? 0)
        k.putInt("derivationType", account.hdWalletAddressDetail?.derivationTypeOrdinal)
        k.putBytes("privateKey", readHDPrivateKey(
            walletId: walletId,
            address: account.address,
            keychain: keychain
        ))
        return k.dict
    }

    private static func readWalletEntropy(walletId: String, keychain: KeychainReader) -> Data? {
        let seed = (try? keychain.readHDWalletSeed(walletId: walletId)) ?? nil
        guard let entropy = seed?.entropy else { return nil }
        return Data(base64Encoded: entropy)
    }

    private static func readHDPrivateKey(
        walletId: String,
        address: String,
        keychain: KeychainReader
    ) -> Data? {
        let entry = (try? keychain.readHDAddress(walletId: walletId, address: address)) ?? nil
        guard let pkB64 = entry?.privateKey else { return nil }
        return Data(base64Encoded: pkB64)
    }
}
