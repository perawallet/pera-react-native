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

import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { createElement, useCallback } from 'react'
import { useCardStore } from '@perawallet/wallet-core-card'
import {
    canSignDirectly,
    canSignProgram,
    findAccountByAddressOn,
    hasCustody,
    isRekeyedAccount,
    localKeyKindOf,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    AccountMenuContent,
    type AccountMenuContentResult,
} from '@modules/accounts'
import { useBottomSheet } from '@modules/bottom-sheet'
import { ConnectAccountHeader } from '../components/ConnectAccountHeader'
import { useCardAddAccount } from './useCardAddAccount'

// The card's ownership proof and AutoDraw delegation are Ed25519 signatures,
// so a local key of any other scheme can't back the card.
const CARD_SIGNING_SCHEME = 'ed25519'

const holdsCardSigningKey = (
    account: WalletAccount,
    chainId: ChainId,
): boolean =>
    hasCustody(account, 'hardware') ||
    (hasCustody(account, 'local') &&
        localKeyKindOf(chainId, account.custody.seed)?.signingScheme ===
            CARD_SIGNING_SCHEME)

/**
 * Accounts eligible as the card's funding source: local and hardware accounts
 * whose key signs Ed25519. Watch, multisig and rekeyed accounts can't act as
 * a funding source.
 */
export const isEligibleFundingSource = (
    account: WalletAccount,
    chainId: ChainId,
): boolean =>
    holdsCardSigningKey(account, chainId) && !isRekeyedAccount(account, chainId)

/**
 * Funding sources that can also sign the ARC-60 ownership proof card creation
 * needs — the stricter filter onboarding uses. Gates on `canSignDirectly`
 * rather than `canSignArbitraryData`: Ledger signs ARC-60 on-device, holding no
 * local key.
 */
export const isSigningCapableFundingSource = (
    account: WalletAccount,
    chainId: ChainId,
): boolean =>
    isEligibleFundingSource(account, chainId) && canSignDirectly(account)

/**
 * Whether `account` can turn ON auto funding, i.e. sign the delegated AutoDraw
 * LSig. Stays narrower than {@link isSigningCapableFundingSource}: Ledger
 * creates cards but its firmware will never sign a program.
 */
export const canAutoFund = (
    account: WalletAccount,
    chainId: ChainId,
): boolean => canSignProgram(account, chainId)

export type UseCardFundingSourcePickerResult = {
    /**
     * Opens the eligible-accounts picker and resolves with the chosen account,
     * or null when dismissed or when the add-account flow takes over.
     */
    pickFundingSource: () => Promise<Nullable<WalletAccount>>
}

export type UseCardFundingSourcePickerParams = {
    /**
     * Which accounts to offer. Defaults to {@link isEligibleFundingSource};
     * onboarding passes {@link isSigningCapableFundingSource}, which also
     * requires the account to be able to sign the creation proof.
     */
    accountFilter?: (account: WalletAccount, chainId: ChainId) => boolean
}

export const useCardFundingSourcePicker = ({
    accountFilter = isEligibleFundingSource,
}: UseCardFundingSourcePickerParams = {}): UseCardFundingSourcePickerResult => {
    const { request } = useBottomSheet()
    const { handleCreateAccount } = useCardAddAccount()
    const connectedAddress = useCardStore(
        state => state.connectedFundingSourceAddress,
    )
    const accounts = useAllAccounts()
    const connectedAccountId = connectedAddress
        ? (findAccountByAddressOn(accounts, LEGACY_CHAIN_ID, connectedAddress)
              ?.id ?? null)
        : null

    const pickFundingSource = useCallback(async (): Promise<
        Nullable<WalletAccount>
    > => {
        // Reuse the standard account menu, but with its title row replaced:
        // ConnectAccountHeader supplies the card flow's own heading and
        // "Create Account" action, and offers no sorting.
        const result = await request<AccountMenuContentResult>({
            id: 'card-connect-funding-source',
            contents: createElement(AccountMenuContent, {
                headerContent: createElement(ConnectAccountHeader),
                hideDefaultHeader: true,
                accountFilter: (account: WalletAccount) =>
                    accountFilter(account, LEGACY_CHAIN_ID),
                // Fresh on first connect (null → nothing highlighted);
                // the connected source is highlighted on "Change".
                selectedAccountId: connectedAccountId,
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
            default: {
                return null
            }
        }
    }, [request, handleCreateAccount, connectedAccountId, accountFilter])

    return { pickFundingSource }
}
