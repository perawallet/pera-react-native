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
import {
    findAccountByAddressOn,
    isWatchAccount,
    useAllAccounts,
    useTokenInboxQuery,
    useWalletHoldingSources,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { InboxItem } from '@perawallet/wallet-core-messages'
import type { Optional } from '@perawallet/wallet-core-shared'

type AsaInboxItem = Extract<InboxItem, { type: 'asa_inbox' }>

/** An account's incoming assets on every chain it holds, behind one inbox row. */
export type AccountAssetInbox = {
    account: WalletAccount
    /** The inbox backend's requests for the account's address on an opt-in chain. */
    backendItem: Optional<AsaInboxItem>
    /** Tokens waiting on chains that receive them unasked, across networks. */
    tokenCount: number
    requestCount: number
}

/** The row the inbox lists in place of the backend's per-address one. */
export type AccountAssetsInboxItem = {
    type: 'account_assets'
    data: AccountAssetInbox
}

export type UseAccountAssetInboxesParams = {
    /** The backend inbox's items and the scope they were read on. */
    backendItems: readonly InboxItem[]
    backendScope: ChainScope
}

/**
 * One inbox per account holding incoming assets: the backend's requests on an
 * opt-in chain and the tokens waiting on device, merged. A watch account can't
 * accept or claim anything, so it has none.
 */
export const useAccountAssetInboxes = ({
    backendItems,
    backendScope,
}: UseAccountAssetInboxesParams): AccountAssetInbox[] => {
    const accounts = useAllAccounts()
    const walletSources = useWalletHoldingSources()
    const signingAccounts = useMemo(
        () => accounts.filter(account => !isWatchAccount(account)),
        [accounts],
    )
    const sources = useMemo(
        () =>
            walletSources.filter(
                ({ address, scope }) =>
                    findAccountByAddressOn(
                        signingAccounts,
                        scope.chainId,
                        address,
                    ) !== undefined,
            ),
        [walletSources, signingAccounts],
    )
    const { holdings } = useTokenInboxQuery(sources)

    return useMemo(() => {
        const tokenCounts = new Map<string, number>()
        for (const { address, scope } of holdings) {
            const account = findAccountByAddressOn(
                signingAccounts,
                scope.chainId,
                address,
            )
            if (account) {
                tokenCounts.set(
                    account.id,
                    (tokenCounts.get(account.id) ?? 0) + 1,
                )
            }
        }
        const backendItemOf = (account: WalletAccount) =>
            backendItems.find(
                (item): item is AsaInboxItem =>
                    item.type === 'asa_inbox' &&
                    item.data.requestCount > 0 &&
                    findAccountByAddressOn(
                        [account],
                        backendScope.chainId,
                        item.data.address,
                    ) !== undefined,
            )
        return signingAccounts.flatMap((account): AccountAssetInbox[] => {
            const backendItem = backendItemOf(account)
            const tokenCount = tokenCounts.get(account.id) ?? 0
            const requestCount =
                (backendItem?.data.requestCount ?? 0) + tokenCount
            return requestCount > 0
                ? [{ account, backendItem, tokenCount, requestCount }]
                : []
        })
    }, [holdings, signingAccounts, backendItems, backendScope.chainId])
}
