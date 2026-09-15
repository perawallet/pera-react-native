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

import { useMemo } from 'react'
import { useCardStore } from '@perawallet/wallet-core-card'
import {
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * The local account the card draws from, resolved from the stored address.
 *
 * Null when nothing is connected or when the stored address no longer belongs
 * to this wallet, which is why callers must resolve the account rather than
 * trust the address alone.
 */
export const useCardFundingAccount = (): Nullable<WalletAccount> => {
    const connectedAddress = useCardStore(
        state => state.connectedFundingSourceAddress,
    )
    const accounts = useAllAccounts()

    return useMemo(
        () =>
            accounts.find(account => account.address === connectedAddress) ??
            null,
        [accounts, connectedAddress],
    )
}
