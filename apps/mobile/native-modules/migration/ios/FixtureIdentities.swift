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

enum FixtureIdentities {

    // MARK: - HD wallet (single seed, three derived keys)

    static let hdWalletId = "550E8400-E29B-41D4-A716-446655440000"
    static let hdWalletName = "Test Seed"
    static let hdWalletEntropyHex = FixtureCrypto.HD_WALLET_ENTROPY_HEX

    static let hdKey0Address = FixtureCrypto.HD_KEY_0_ADDRESS
    static let hdKey0Sk64Hex = FixtureCrypto.HD_KEY_0_SK64_HEX
    static let hdKey1Address = FixtureCrypto.HD_KEY_1_ADDRESS
    static let hdKey1Sk64Hex = FixtureCrypto.HD_KEY_1_SK64_HEX
    static let hdKey2Address = FixtureCrypto.HD_KEY_2_ADDRESS
    static let hdKey2Sk64Hex = FixtureCrypto.HD_KEY_2_SK64_HEX

    // MARK: - Algo25 (standard) accounts

    static let algo25ValidAddress = FixtureCrypto.ALGO25_VALID_ADDRESS
    static let algo25ValidSk64Hex = FixtureCrypto.ALGO25_VALID_SK64_HEX

    static let standardNoKeyAddress = "STANDARDNOKEYACCOUNT" + String(repeating: "A", count: 38)

    // MARK: - Watch-only

    static let watchOnlyAddress = FixtureCrypto.WATCH_1_ADDRESS

    // MARK: - Ledger BLE

    static let ledgerPeripheralId = "B6F1A2C3-1234-4D5E-8A9B-0123456789AB"
    static let ledgerValidAddress = FixtureCrypto.LEDGER_1_ADDRESS
    static let ledgerValidName = "Ledger Nano X"
    static let ledgerValidIndex = 0

    static let ledgerNullIdAddress = FixtureCrypto.LEDGER_2_ADDRESS
    static let ledgerNullIdIndex = 3

    // MARK: - Rekeyed to Ledger (auth account not held locally)

    static let rekeyedToLedgerAddress =
        "REKEYEDTOLEDGERACCOUNT" + String(repeating: "A", count: 36)
    static let rekeyAuthLedgerAddress =
        "REKEYAUTHLEDGERACCOUNT" + String(repeating: "A", count: 36)
    static let rekeyAuthLedgerPeripheralId = "C7E2B3D4-2345-4E6F-9B0C-1234567890BC"
    static let rekeyAuthLedgerName = "Ledger Nano S Plus"
    static let rekeyAuthLedgerIndex = 1

    // MARK: - Joint (multisig)

    static let jointAddress = FixtureCrypto.WATCH_2_ADDRESS
    static let jointThreshold = 2
    static let jointVersion = 1
    static let jointParticipants = [
        FixtureCrypto.HD_KEY_0_ADDRESS,
        FixtureCrypto.ALGO25_VALID_ADDRESS,
        FixtureCrypto.EXTERNAL_PARTICIPANT_ADDRESS,
    ]

    // MARK: - Device identifiers (in the User blob)

    static let mainnetDeviceId = "ios-sim-mainnet-device-id"
    static let testnetDeviceId = "ios-sim-testnet-device-id"
    static let notificationUserId = "ios-sim-notification-user-id"
    static let legacyFallbackDeviceId = "ios-sim-legacy-fallback-device-id"

    // MARK: - Auth

    static let pinDigits = "123456"

    // MARK: - Contacts (Core Data `ZCONTACT`)

    struct ContactFixture {
        let name: String
        let address: String
        let imagePngBase64: String?
    }

    static let onePixelPngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

    static let contacts: [ContactFixture] = [
        ContactFixture(
            name: "Alice",
            address: FixtureCrypto.EXTERNAL_PARTICIPANT_ADDRESS,
            imagePngBase64: onePixelPngBase64
        ),
        ContactFixture(
            name: "Bob",
            address: "CONTACTBOBADDRESS" + String(repeating: "C", count: 41),
            imagePngBase64: nil
        ),
        ContactFixture(
            name: "",
            address: "CONTACTNONAMEADDRESS" + String(repeating: "D", count: 38),
            imagePngBase64: nil
        ),
        ContactFixture(
            name: "Ghost",
            address: "",
            imagePngBase64: nil
        ),
    ]

    // MARK: - Passkeys (Core Data `ZPASSKEY`)

    struct PasskeyFixture {
        let address: String
        let credentialId: String
        let origin: String
        let username: String?
        let displayName: String?
        let userHandleBase64: String?
        let lastUsedSecondsSince2001: Double?
    }

    static let passkeys: [PasskeyFixture] = [
        PasskeyFixture(
            address: FixtureCrypto.ALGO25_VALID_ADDRESS,
            credentialId: "credential-id-fixture-0001",
            origin: "https://app.perawallet.app",
            username: "alice@example.com",
            displayName: "Alice Example",
            userHandleBase64: "dXNlci1oYW5kbGUtMQ==",
            lastUsedSecondsSince2001: 726_883_200
        ),
        PasskeyFixture(
            address: FixtureCrypto.WATCH_1_ADDRESS,
            credentialId: "",
            origin: "https://example.com",
            username: nil,
            displayName: nil,
            userHandleBase64: nil,
            lastUsedSecondsSince2001: nil
        ),
    ]

    // MARK: - Helpers

    static func hexToData(_ hex: String) -> Data {
        var data = Data(capacity: hex.count / 2)
        var index = hex.startIndex
        while index < hex.endIndex {
            let next = hex.index(index, offsetBy: 2, limitedBy: hex.endIndex) ?? hex.endIndex
            guard next > index,
                  let byte = UInt8(hex[index..<next], radix: 16) else {
                return Data()
            }
            data.append(byte)
            index = next
        }
        return data
    }
}
