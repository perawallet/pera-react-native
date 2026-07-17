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

import { createElement, useCallback } from 'react'
import { useCardStore } from '@perawallet/wallet-core-card'
import {
    canSignArbitraryData,
    isAlgo25Account,
    isHardwareWalletAccount,
    isHDWalletAccount,
    isRekeyedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    AccountMenuContent,
    type AccountMenuContentResult,
} from '@modules/accounts/components/AccountMenuContent'
import { AccountSortContent } from '@modules/accounts/components/AccountSortContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { ConnectAccountHeader } from '../components/ConnectAccountHeader'
import { useCardAddAccount } from './useCardAddAccount'

/**
 * Accounts eligible as the card's funding source: standard, HD, and Ledger
 * accounts that can sign — watch-only and multisig (by type) and any rekeyed
 * account are excluded, since they can't act as a funding source.
 */
export const isEligibleFundingSource = (account: WalletAccount): boolean =>
    (isAlgo25Account(account) ||
        isHDWalletAccount(account) ||
        isHardwareWalletAccount(account)) &&
    !isRekeyedAccount(account)

/**
 * Funding sources that can also produce a signature — the stricter filter used
 * during onboarding, where creating the card requires an ARC-60 (and, for Auto,
 * a delegated LSig) signature. Excludes Ledger, which is eligible as a funding
 * source but can't sign arbitrary data / programs.
 */
export const isSigningCapableFundingSource = (
    account: WalletAccount,
): boolean => isEligibleFundingSource(account) && canSignArbitraryData(account)

export type UseCardFundingSourcePickerResult = {
    /**
     * Opens the eligible-accounts picker and resolves with the chosen account,
     * or null when dismissed or when the add-account flow takes over.
     */
    pickFundingSource: () => Promise<Nullable<WalletAccount>>
}

export type UseCardFundingSourcePickerParams = {
    /**
     * Which accounts to offer. Defaults to {@link isEligibleFundingSource}
     * (includes Ledger); onboarding passes {@link isSigningCapableFundingSource}
     * so only signing-capable accounts are offered.
     */
    accountFilter?: (account: WalletAccount) => boolean
}

export const useCardFundingSourcePicker = ({
    accountFilter = isEligibleFundingSource,
}: UseCardFundingSourcePickerParams = {}): UseCardFundingSourcePickerResult => {
    const { request } = useBottomSheet()
    const { handleCreateAccount } = useCardAddAccount()
    const connectedAddress = useCardStore(
        state => state.connectedFundingSourceAddress,
    )

    const pickFundingSource = useCallback(async (): Promise<
        Nullable<WalletAccount>
    > => {
        // Reuse the standard account menu as-is, customised only through
        // its existing props: the card header and the eligibility filter.
        const openPicker = async (): Promise<Nullable<WalletAccount>> => {
            const result = await request<AccountMenuContentResult>({
                id: 'card-connect-funding-source',
                contents: createElement(AccountMenuContent, {
                    headerContent: createElement(ConnectAccountHeader),
                    accountFilter,
                    // Fresh on first connect (null → nothing highlighted);
                    // the connected source is highlighted on "Change".
                    selectedAddress: connectedAddress,
                }),
                options: {
                    size: 'full',
                    enablePanDownToClose: false,
                    enableContentPanningGesture: false,
                    autoCreateContainer: false,
                },
            })
            if (!result) return null
            switch (result.kind) {
                case 'selected': {
                    return result.account
                }
                case 'add-account': {
                    handleCreateAccount()
                    return null
                }
                case 'sort': {
                    await request<void>({
                        contents: createElement(AccountSortContent),
                        options: {
                            size: 'modal',
                            enablePanDownToClose: false,
                            enableContentPanningGesture: false,
                            autoCreateContainer: false,
                        },
                    })
                    // After sorting, reopen the picker so the user can choose.
                    return openPicker()
                }
                case 'search':
                default: {
                    return null
                }
            }
        }
        return openPicker()
    }, [request, handleCreateAccount, connectedAddress, accountFilter])

    return { pickFundingSource }
}
