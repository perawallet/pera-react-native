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

enum AccountsBuilder {

    static func compose(
        accounts: [LegacyUserBlob.LegacyAccountInfo],
        keychain: KeychainReader
    ) -> [Any] {
        var out: [Any] = []
        var addresses = Set<String>()

        for info in accounts {
            out.append(composeAccount(info: info, keychain: keychain))
            addresses.insert(info.address)
        }

        for info in accounts {
            guard let rekeyDetail = info.rekeyDetail else { continue }
            for (authAddress, ledger) in rekeyDetail {
                guard !addresses.contains(authAddress) else { continue }
                let ledgerMap = composeLedger(ledger)
                if ledgerMap is NSNull {
                    out.append(authWatchAccount(
                        address: authAddress,
                        preferredOrder: info.preferredOrder
                    ))
                } else {
                    out.append(authLedgerAccount(
                        address: authAddress,
                        ledger: ledgerMap,
                        preferredOrder: info.preferredOrder
                    ))
                }
                addresses.insert(authAddress)
            }
        }

        return out
    }

    private static func composeAccount(
        info: LegacyUserBlob.LegacyAccountInfo,
        keychain: KeychainReader
    ) -> [String: Any] {
        var m = BridgeMap()
        m.putString("address", info.address)
        m.putString("name", info.name ?? info.address)
        m.putString("type", info.type ?? "standard")
        m.putInt("preferredOrder", info.preferredOrder ?? 0)
        m.putBool("isBackedUp", info.isBackedUp ?? false)
        m.putBytes("secretKey", resolveSecretKey(forAddress: info.address, keychain: keychain))
        m.putString("hdWalletId", info.hdWalletAddressDetail?.walletId)
        m.putRaw("ledger", composeLedger(info.ledgerDetail))
        m.putRaw("joint", composeJoint(info.jointAccountDetail))
        m.putString("authAddress", info.rekeyDetail?.keys.first)
        return m.dict
    }

    private static func authLedgerAccount(
        address: String,
        ledger: Any,
        preferredOrder: Int?
    ) -> [String: Any] {
        var m = BridgeMap()
        m.putString("address", address)
        m.putString("name", "")
        m.putString("type", "ledger")
        m.putInt("preferredOrder", preferredOrder ?? 0)
        m.putBool("isBackedUp", false)
        m.putBytes("secretKey", nil)
        m.putString("hdWalletId", nil)
        m.putRaw("ledger", ledger)
        m.putRaw("joint", NSNull())
        m.putString("authAddress", nil)
        return m.dict
    }

    private static func authWatchAccount(
        address: String,
        preferredOrder: Int?
    ) -> [String: Any] {
        var m = BridgeMap()
        m.putString("address", address)
        m.putString("name", "")
        m.putString("type", "watch")
        m.putInt("preferredOrder", preferredOrder ?? 0)
        m.putBool("isBackedUp", false)
        m.putBytes("secretKey", nil)
        m.putString("hdWalletId", nil)
        m.putRaw("ledger", NSNull())
        m.putRaw("joint", NSNull())
        m.putString("authAddress", nil)
        return m.dict
    }

    private static func resolveSecretKey(
        forAddress address: String,
        keychain: KeychainReader
    ) -> Data? {
        guard let data = try? keychain.readAccountSecretKey(for: address),
              data.count == 64
        else { return nil }
        return data
    }

    private static func composeLedger(_ ledger: LegacyUserBlob.LedgerDetail?) -> Any {
        guard let ledger = ledger, let bluetoothAddress = ledger.id
        else { return NSNull() }
        var m = BridgeMap()
        m.putString("bluetoothAddress", bluetoothAddress)
        m.putString("bluetoothName", ledger.name)
        m.putInt("positionInLedger", ledger.index ?? 0)
        return m.dict
    }

    private static func composeJoint(_ joint: LegacyUserBlob.JointAccountDetail?) -> Any {
        guard let joint = joint else { return NSNull() }
        var m = BridgeMap()
        m.putRaw("participants", joint.participants ?? [])
        m.putInt("threshold", joint.threshold)
        m.putInt("version", joint.version)
        return m.dict
    }
}
