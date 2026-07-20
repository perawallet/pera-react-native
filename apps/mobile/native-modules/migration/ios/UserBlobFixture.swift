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

enum UserBlobFixture {

    static func buildBlobData(includeUnroutable: Bool) throws -> Data {
        let user: [String: Any] = [
            "accounts": accounts(includeUnroutable: includeUnroutable),
            "walletNames": [
                FixtureIdentities.hdWalletId: FixtureIdentities.hdWalletName,
            ],
            "deviceIDOnMainnet": FixtureIdentities.mainnetDeviceId,
            "deviceIDOnTestnet": FixtureIdentities.testnetDeviceId,
            "notificationUserId": FixtureIdentities.notificationUserId,
        ]
        return try JSONSerialization.data(withJSONObject: user, options: [])
    }

    private static func accounts(includeUnroutable: Bool) -> [[String: Any]] {
        var list: [[String: Any]] = []

        list.append(standard(
            address: FixtureIdentities.algo25ValidAddress,
            name: "Algo25 Main",
            order: 0,
            backedUp: true
        ))
        if includeUnroutable {
            list.append(standard(
                address: FixtureIdentities.standardNoKeyAddress,
                name: "No Key",
                order: 1,
                backedUp: false
            ))
        }
        list.append(hd(
            address: FixtureIdentities.hdKey0Address,
            name: "HD Account 0",
            order: 2,
            account: 0,
            change: 0,
            keyIndex: 0,
            backedUp: true,
            receivesNotification: true
        ))
        list.append(hd(
            address: FixtureIdentities.hdKey1Address,
            name: "HD Account 1",
            order: 3,
            account: 0,
            change: 0,
            keyIndex: 1,
            backedUp: false,
            receivesNotification: false
        ))
        list.append(hd(
            address: FixtureIdentities.hdKey2Address,
            name: "HD Account 2",
            order: 4,
            account: 0,
            change: 0,
            keyIndex: 2,
            backedUp: true,
            receivesNotification: true
        ))
        list.append(watch(
            address: FixtureIdentities.watchOnlyAddress,
            name: "Watched",
            order: 5
        ))
        list.append(ledger(
            address: FixtureIdentities.ledgerValidAddress,
            name: "Ledger 0",
            order: 6,
            id: FixtureIdentities.ledgerPeripheralId,
            ledgerName: FixtureIdentities.ledgerValidName,
            index: FixtureIdentities.ledgerValidIndex
        ))
        if includeUnroutable {
            list.append(ledger(
                address: FixtureIdentities.ledgerNullIdAddress,
                name: "Ledger Legacy",
                order: 7,
                id: nil,
                ledgerName: "Ledger Nano S",
                index: FixtureIdentities.ledgerNullIdIndex
            ))
            list.append(rekeyedToLedger(
                address: FixtureIdentities.rekeyedToLedgerAddress,
                name: "Rekeyed To Ledger",
                order: 9,
                authAddress: FixtureIdentities.rekeyAuthLedgerAddress,
                ledgerId: FixtureIdentities.rekeyAuthLedgerPeripheralId,
                ledgerName: FixtureIdentities.rekeyAuthLedgerName,
                ledgerIndex: FixtureIdentities.rekeyAuthLedgerIndex
            ))
            list.append(rekeyedToLedger(
                address: rekeyedToStandardAddress,
                name: "Rekeyed To Standard",
                order: 10,
                authAddress: rekeyAuthWatchAddress,
                ledgerId: nil,
                ledgerName: "Unknown Device",
                ledgerIndex: 0
            ))
        }
        list.append(joint())

        return list
    }

    // MARK: - Rekeyed to Standard (auth account has no ledger id, synthesized as watch)

    private static let rekeyedToStandardAddress =
        "REKEYEDTOSTANDARDACCOUNT" + String(repeating: "A", count: 34)
    private static let rekeyAuthWatchAddress =
        "REKEYAUTHWATCHACCOUNT" + String(repeating: "A", count: 37)

    private static func rekeyedToLedger(
        address: String,
        name: String,
        order: Int,
        authAddress: String,
        ledgerId: String?,
        ledgerName: String,
        ledgerIndex: Int
    ) -> [String: Any] {
        var ledgerDetail: [String: Any] = [
            "name": ledgerName,
            "index": ledgerIndex,
        ]
        if let ledgerId = ledgerId {
            ledgerDetail["id"] = ledgerId
        }
        return [
            "address": address,
            "name": name,
            "type": "standard",
            "preferredOrder": order,
            "isBackedUp": false,
            "receivesNotification": true,
            "rekeyDetail": [
                authAddress: ledgerDetail,
            ] as [String: Any],
        ]
    }

    private static func standard(
        address: String,
        name: String,
        order: Int,
        backedUp: Bool
    ) -> [String: Any] {
        [
            "address": address,
            "name": name,
            "type": "standard",
            "preferredOrder": order,
            "isBackedUp": backedUp,
            "receivesNotification": true,
        ]
    }

    private static func hd(
        address: String,
        name: String,
        order: Int,
        account: Int,
        change: Int,
        keyIndex: Int,
        backedUp: Bool,
        receivesNotification: Bool
    ) -> [String: Any] {
        [
            "address": address,
            "name": name,
            "type": "standard",
            "preferredOrder": order,
            "isBackedUp": backedUp,
            "receivesNotification": receivesNotification,
            "hdWalletAddressDetail": [
                "walletId": FixtureIdentities.hdWalletId,
                "account": account,
                "change": change,
                "keyIndex": keyIndex,
                "derivationType": ["peikert": [String: Any]()],
            ] as [String: Any],
        ]
    }

    private static func watch(
        address: String,
        name: String,
        order: Int
    ) -> [String: Any] {
        [
            "address": address,
            "name": name,
            "type": "watch",
            "preferredOrder": order,
            "isBackedUp": true,
            "receivesNotification": true,
        ]
    }

    private static func ledger(
        address: String,
        name: String,
        order: Int,
        id: String?,
        ledgerName: String,
        index: Int
    ) -> [String: Any] {
        var ledgerDetail: [String: Any] = [
            "name": ledgerName,
            "index": index,
        ]
        if let id = id {
            ledgerDetail["id"] = id
        }
        return [
            "address": address,
            "name": name,
            "type": "ledger",
            "preferredOrder": order,
            "isBackedUp": true,
            "receivesNotification": true,
            "ledgerDetail": ledgerDetail,
        ]
    }

    private static func joint() -> [String: Any] {
        [
            "address": FixtureIdentities.jointAddress,
            "name": "Shared",
            "type": "joint",
            "preferredOrder": 8,
            "isBackedUp": true,
            "receivesNotification": true,
            "jointAccountParticipants": FixtureIdentities.jointParticipants,
            "jointAccountThreshold": FixtureIdentities.jointThreshold,
            "jointAccountVersion": FixtureIdentities.jointVersion,
        ]
    }
}
