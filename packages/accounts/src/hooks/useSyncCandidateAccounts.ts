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

import { useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    selectChainNetworkId,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { logger } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { accountsChainAdapters } from '../chain-adapter'
import { chainAccountOf } from '../credentials'
import { cleanupRemovedAccountData } from '../cleanup'
import { useAccountsStore } from '../store'
import { syncAndEnrichNewAccount } from '../sync/account-syncer'
import type { WalletAccount } from '../models'
import { findAccountByAddressOn, findAccountByAnyChainAddress } from '../utils'

const ENTRY_SEPARATOR = '|'

/**
 * Syncs and enriches the addresses of accounts the wallet doesn't hold yet, so
 * a preview of them (an import's candidates) can show balances and fiat values.
 * The sync writes holdings to SQLite that other readers take whole, so on
 * unmount each address no stored account holds by then is deleted again.
 */
export const useSyncCandidateAccounts = (
    accounts: readonly WalletAccount[],
): void => {
    const queryClient = useQueryClient()

    const entriesKey = useMemo(() => {
        const { chains } = getProvider()
        const chainIds = chains
            .list()
            .map(({ id }) => id)
            .filter(
                id =>
                    accountsChainAdapters.has(id) && !chains.isSwitchedOff(id),
            )
        return accounts
            .flatMap(account =>
                chainIds.flatMap(chainId => {
                    const address = chainAccountOf(account, chainId)?.address
                    return address === undefined
                        ? []
                        : [`${chainId}${ENTRY_SEPARATOR}${address}`]
                }),
            )
            .join('\n')
    }, [accounts])

    useEffect(() => {
        const synced = new Set<string>()
        for (const entry of entriesKey ? entriesKey.split('\n') : []) {
            const separator = entry.indexOf(ENTRY_SEPARATOR)
            const chainId = entry.slice(0, separator) as ChainId
            const address = entry.slice(separator + 1)
            if (
                findAccountByAddressOn(
                    useAccountsStore.getState().accounts,
                    chainId,
                    address,
                )
            ) {
                continue
            }
            synced.add(address)
            void syncAndEnrichNewAccount(
                address,
                {
                    chainId,
                    networkId: selectChainNetworkId(
                        useNetworkStore.getState(),
                        chainId,
                    ),
                },
                queryClient,
            )
        }

        return () => {
            for (const address of synced) {
                if (
                    !findAccountByAnyChainAddress(
                        useAccountsStore.getState().accounts,
                        address,
                    )
                ) {
                    void cleanupRemovedAccountData({
                        accountAddress: address,
                    }).catch(error => {
                        logger.warn('Candidate account cleanup failed', {
                            address,
                            error,
                        })
                    })
                }
            }
        }
    }, [entriesKey, queryClient])
}
