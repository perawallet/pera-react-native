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
    getAllAccounts,
    getSelectedAccountId,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import {
    resolveSendAccount,
    type SendAccountResolution,
} from './resolveSendAccount'

type UseSendAccountResolverResult = {
    /** Reads the accounts at call time, so a caller never acts on a stale list. */
    resolve: (chainId: ChainId) => SendAccountResolution
    /** Resolves undefined when the user dismisses the picker. */
    pick: (
        chainId: ChainId,
        accounts: WalletAccount[],
    ) => Promise<Maybe<WalletAccount>>
}

const SHEET_OPTIONS = {
    // PWSheetLayout only scrolls when it owns the container: needs
    // autoCreateContainer:false + bounded auto size.
    size: 'auto',
    enablePanDownToClose: true,
    autoCreateContainer: false,
} as const

export const useSendAccountResolver = (): UseSendAccountResolverResult => {
    const { requestByType } = useBottomSheetStore()

    const resolve = useCallback((chainId: ChainId) => {
        return resolveSendAccount({
            accounts: getAllAccounts(),
            selectedAccountId: getSelectedAccountId(),
            chainId,
        })
    }, [])

    const pick = useCallback(
        async (chainId: ChainId, accounts: WalletAccount[]) => {
            const accountId = await requestByType<
                'send-account-selection',
                string
            >(
                'send-account-selection',
                { chainId, accountIds: accounts.map(({ id }) => id) },
                SHEET_OPTIONS,
            )
            return accounts.find(({ id }) => id === accountId)
        },
        [requestByType],
    )

    return { resolve, pick }
}
