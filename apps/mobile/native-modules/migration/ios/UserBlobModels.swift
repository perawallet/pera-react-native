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

enum LegacyUserBlob {

    struct User: Decodable {
        let accounts: [LegacyAccountInfo]?
        let walletNames: [String: String]?

        let deviceIDOnMainnet: String?
        let deviceIDOnTestnet: String?
        let deviceId: String?

        let notificationUserId: String?
    }

    struct LegacyAccountInfo: Decodable {
        let address: String
        let name: String?
        let type: String?
        let preferredOrder: Int?
        let isBackedUp: Bool?
        let receivesNotification: Bool?

        let hdWalletAddressDetail: HDWalletAddressDetail?
        let ledgerDetail: LedgerDetail?
        let jointAccountParticipants: [String]?
        let jointAccountThreshold: Int?
        let jointAccountVersion: Int?
        let rekeyDetail: [String: RekeyDetailEntry]?
    }

    struct HDWalletAddressDetail: Decodable {
        let walletId: String
        let account: Int?
        let change: Int?
        let keyIndex: Int?
        let derivationType: [String: AnyCodable]?
    }

    struct LedgerDetail: Decodable {
        let id: String?
        let name: String?
        let index: Int?
    }

    struct JointAccountDetail {
        let participants: [String]?
        let threshold: Int?
        let version: Int?
    }

    struct RekeyDetailEntry: Decodable {}

    struct AnyCodable: Decodable {
        let value: Any?

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if container.decodeNil() {
                self.value = nil
            } else if let bool = try? container.decode(Bool.self) {
                self.value = bool
            } else if let int = try? container.decode(Int.self) {
                self.value = int
            } else if let double = try? container.decode(Double.self) {
                self.value = double
            } else if let string = try? container.decode(String.self) {
                self.value = string
            } else {
                self.value = nil
            }
        }
    }
}

extension LegacyUserBlob.HDWalletAddressDetail {
    var derivationTypeOrdinal: Int? {
        guard let map = derivationType, let key = map.keys.first else { return nil }
        switch key.lowercased() {
        case "peikert": return 9
        case "bip32":   return 32
        default:        return nil
        }
    }
}

extension LegacyUserBlob.LegacyAccountInfo {
    var jointAccountDetail: LegacyUserBlob.JointAccountDetail? {
        guard let participants = jointAccountParticipants,
              !participants.isEmpty
        else { return nil }
        return LegacyUserBlob.JointAccountDetail(
            participants: participants,
            threshold: jointAccountThreshold,
            version: jointAccountVersion ?? 1
        )
    }
}
