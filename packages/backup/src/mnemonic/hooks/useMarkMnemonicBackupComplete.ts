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

import { useCallback } from 'react'
import { seedOf, type WalletAccount } from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import { useMnemonicBackupStore } from '../store'

export type UseMarkMnemonicBackupCompleteResult = (
    account: WalletAccount,
) => void

const hasLocalKey = (account: WalletAccount): boolean =>
    account.custody.kind === 'local' &&
    Object.values(account.chains).some(entry => entry?.keyPairId)

export const useMarkMnemonicBackupComplete =
    (): UseMarkMnemonicBackupCompleteResult => {
        const markBackedUp = useMnemonicBackupStore(state => state.markBackedUp)

        return useCallback(
            (account: WalletAccount) => {
                const seedId = seedOf(account)
                if (seedId === undefined) {
                    // Imports and restores mark right after minting keys, so a
                    // local account that still resolves no seed means the mark
                    // raced the keystore and the reminder will wrongly stay.
                    if (hasLocalKey(account)) {
                        logger.warn(
                            'useMarkMnemonicBackupComplete: no seed resolved for a local account',
                            { accountId: account.id },
                        )
                    }
                    return
                }
                markBackedUp(seedId)
            },
            [markBackedUp],
        )
    }
