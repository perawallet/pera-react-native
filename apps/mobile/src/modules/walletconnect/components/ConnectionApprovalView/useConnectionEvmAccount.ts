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

import { useCallback, useMemo, useState } from 'react'
import {
    accountsSigningOnAll,
    findAccountByAddressOn,
    firstUnreachableChainsNote,
    firstPreferredAccountId,
    useAllAccounts,
    useSelectedAccountId,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { i18nKey, type ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    useConnectionsStore,
    type ConnectionProposal,
} from '@perawallet/wallet-core-connections'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useConnectAccountPicker } from '../../hooks/useConnectAccountPicker'

export type UseConnectionEvmAccountResult = {
    /** The first requested EVM chain; absent when the proposal asks for none. */
    evmChainId: Optional<ChainId>
    /** Accounts that sign on every requested EVM chain, in the given order. */
    evmCandidates: WalletAccount[]
    /** The one account EVM chains are granted to; `null` when none can be. */
    evmAccount: Nullable<WalletAccount>
    handleEvmAccountPress: () => Promise<void>
    /** Why no account can take the EVM chains; absent when one can or none is requested. */
    evmNoAccountsNote: Optional<string>
}

export const useConnectionEvmAccount = (
    proposal: ConnectionProposal,
    sortedAccounts: WalletAccount[],
    evmChainIds: ChainId[],
): UseConnectionEvmAccountResult => {
    const { t } = useLanguage()
    const accounts = useAllAccounts()
    const evmChainId = evmChainIds[0]
    const evmCandidates = useMemo(
        () => accountsSigningOnAll(sortedAccounts, accounts, evmChainIds),
        [sortedAccounts, accounts, evmChainIds],
    )
    const { selectedAccountId } = useSelectedAccountId()
    const storedConnections = useConnectionsStore(state => state.connections)
    // A site asking again keeps the account it already has unless the user
    // picks another; moving it to Pera's selected account would switch it quietly.
    const connectedAccountId = useMemo(() => {
        if (!proposal.requesterOrigin || evmChainId === undefined) return null
        const existing = storedConnections.find(
            connection =>
                connection.kind === proposal.kind &&
                connection.origin?.requesterOrigin === proposal.requesterOrigin,
        )
        for (const address of existing?.accounts ?? []) {
            const account = findAccountByAddressOn(
                accounts,
                evmChainId,
                address,
            )
            if (account) return account.id
        }
        return null
    }, [
        storedConnections,
        proposal.kind,
        proposal.requesterOrigin,
        accounts,
        evmChainId,
    ])
    const [pickedEvmAccountId, setPickedEvmAccountId] =
        useState<Nullable<string>>(null)
    const evmAccountId = firstPreferredAccountId(evmCandidates, [
        pickedEvmAccountId,
        connectedAccountId,
        selectedAccountId,
    ])
    const evmAccount =
        evmCandidates.find(({ id }) => id === evmAccountId) ?? null
    const { pickAccount } = useConnectAccountPicker()

    const handleEvmAccountPress = useCallback(async () => {
        if (evmChainId === undefined) return
        const picked = await pickAccount({
            accounts: evmCandidates,
            chainId: evmChainId,
            selectedAccountId: evmAccountId,
            title: t('walletconnect.request.account_picker_title'),
        })
        if (picked) setPickedEvmAccountId(picked)
    }, [evmChainId, evmCandidates, evmAccountId, pickAccount, t])

    // Per family: on a mixed proposal the Algorand list is not empty, so its
    // own note never says why the EVM row is.
    const evmNoAccountsNote = useMemo(
        () =>
            evmChainIds.length === 0 || evmCandidates.length > 0
                ? undefined
                : t(
                      firstUnreachableChainsNote(accounts, evmChainIds) ??
                          i18nKey('walletconnect.request.no_accounts'),
                  ),
        [evmChainIds, evmCandidates.length, accounts, t],
    )

    return {
        evmChainId,
        evmCandidates,
        evmAccount,
        handleEvmAccountPress,
        evmNoAccountsNote,
    }
}
