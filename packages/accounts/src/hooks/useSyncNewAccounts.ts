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

import { useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CHAIN_IDS, type ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    selectChainNetworkId,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { accountsChainAdapters } from '../chain-adapter'
import { chainAccountOf } from '../credentials'
import { useAccountsStore } from '../store'
import { syncAndEnrichNewAccount } from '../sync/account-syncer'

export type UseSyncNewAccountsOptions = {
    isEnabled?: boolean
}

const ENTRY_SEPARATOR = '|'

/**
 * Watches every chain entry of every account and runs a targeted sync +
 * asset/price enrichment, on that chain's scope, for each one added during the
 * session — import, create, watch, HD discovery, a chain enabled on an existing
 * account — so it shows real balances within seconds instead of waiting on the
 * gated background poll. That poll reads a scope only past its change cursor,
 * so it never picks up an address whose activity predates it.
 *
 * Mount once near the app root. The entries present at first render are left
 * to the sync service's initial full pass.
 *
 * `isEnabled` gates the sync. During legacy→RN migration it must stay false
 * until the migrated device id is written: enriching an account before the
 * device id lands fetches assets over the unscoped endpoint and caches
 * `is_favorited: false` under the asset TTL, so migrated favorites never
 * reappear. While disabled the baseline is left unset so the
 * first enabled run re-establishes it without syncing.
 */
export const useSyncNewAccounts = ({
    isEnabled = true,
}: UseSyncNewAccountsOptions = {}): void => {
    const queryClient = useQueryClient()
    const accounts = useAccountsStore(state => state.accounts)

    // The store array gets a new reference on every write (including each
    // background sync tick), so key the effect on the joined entry set —
    // it only fires when membership actually changes.
    const entriesKey = useMemo(() => {
        const { chains } = getProvider()
        const chainIds = CHAIN_IDS.filter(
            chainId =>
                accountsChainAdapters.has(chainId) &&
                !chains.isSwitchedOff(chainId),
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

    const knownEntries = useRef<Nullable<Set<string>>>(null)

    useEffect(() => {
        if (!isEnabled) return

        const entries = entriesKey ? entriesKey.split('\n') : []
        const known = knownEntries.current

        // First run: record the baseline without syncing — startup accounts
        // are covered by the sync service's initial force-sync.
        if (known === null) {
            knownEntries.current = new Set(entries)
            return
        }

        const added = entries.filter(entry => !known.has(entry))
        // Rebuild (rather than accumulate) so an entry that is removed and
        // later re-added counts as new again.
        knownEntries.current = new Set(entries)

        added.forEach(entry => {
            const separator = entry.indexOf(ENTRY_SEPARATOR)
            const chainId = entry.slice(0, separator) as ChainId
            const address = entry.slice(separator + 1)
            const scope = {
                chainId,
                networkId: selectChainNetworkId(
                    useNetworkStore.getState(),
                    chainId,
                ),
            }
            void syncAndEnrichNewAccount(address, scope, queryClient)
        })
    }, [isEnabled, entriesKey, queryClient])
}
