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

import { useCallback } from 'react'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useBackupStore } from '../store'
import { getBackupKeyId } from '../utils'

export type UseMarkBackupCompleteResult = (account: WalletAccount) => void

export const useMarkBackupComplete = (): UseMarkBackupCompleteResult => {
    const accounts = useAccountsStore(state => state.accounts)
    const markMultipleBackedUp = useBackupStore(
        state => state.markMultipleBackedUp,
    )

    return useCallback(
        (account: WalletAccount) => {
            const keyId = getBackupKeyId(account)
            if (keyId === null) return

            const siblingKeyIds = accounts
                .map(getBackupKeyId)
                .filter((id): id is string => id === keyId)

            const idsToMark = siblingKeyIds.length > 0 ? siblingKeyIds : [keyId]
            markMultipleBackedUp(Array.from(new Set(idsToMark)))
        },
        [accounts, markMultipleBackedUp],
    )
}
