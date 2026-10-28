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
import {
    accountNumberOf,
    getAccountDisplayName,
    isNamedAfterOwnAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'

export type UseAccountNameResult = {
    getAccountName: (
        account: Nullable<WalletAccount>,
        chainId: ChainId,
    ) => string
}

/**
 * An unnamed account with a place in a seed or device reads "Account #N";
 * any other unnamed account falls back to its truncated address on `chainId`.
 */
export const useAccountName = (): UseAccountNameResult => {
    const { t } = useLanguage()

    const getAccountName = useCallback(
        (account: Nullable<WalletAccount>, chainId: ChainId): string => {
            if (account && (!account.name || isNamedAfterOwnAddress(account))) {
                const number = accountNumberOf(account)
                if (number !== undefined) {
                    return t('account_info.account_number', { number })
                }
            }
            return getAccountDisplayName(account, chainId)
        },
        [t],
    )

    return { getAccountName }
}
