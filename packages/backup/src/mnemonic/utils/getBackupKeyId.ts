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

import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'

export const getBackupKeyId = (account: WalletAccount): string | null => {
    switch (account.type) {
        case AccountTypes.algo25:
            return account.seedKeyId ?? account.keyPairId
        case AccountTypes.hdWallet:
            // HD siblings must share a single backup state keyed by entropyKeyId.
            // Falling back to keyPairId would dedup each sibling separately.
            if (!account.entropyKeyId) {
                logger.warn(
                    'getBackupKeyId: HD account is missing entropyKeyId; sibling dedup will be broken',
                )
                return account.keyPairId
            }
            return account.entropyKeyId
        default:
            return null
    }
}
