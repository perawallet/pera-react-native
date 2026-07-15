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

import { useQueryClient } from '@tanstack/react-query'
import { logger } from '@perawallet/wallet-core-shared'
import { invalidateAssetQueries } from '@perawallet/wallet-core-assets'
import { useKMS } from '@perawallet/wallet-core-kms'
import { useAccountsStore } from '../store'
import { cleanupRemovedAccountData } from '../cleanup'
import {
    invalidateAccountQueries,
    removeAccountQueriesForAddresses,
} from './querykeys'

// Removal is keyed by address (the store's unique key) rather than `id`:
// hardware accounts imported via the Ledger pairing flow carry no `id`.
export const useRemoveAccountByAddress = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const { deleteKey, seedIdOf, removeKeyAndChildren } = useKMS()
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const queryClient = useQueryClient()

    return async (address: string) => {
        const account = accounts.find(a => a.address === address)
        const remaining = accounts.filter(a => a.address !== address)

        if (account?.keyPairId) {
            const childKeyId = account.keyPairId
            const seedId = seedIdOf(childKeyId)

            if (seedId) {
                // Always wipe this account's own derived child — no other
                // account references it (account.address is unique).
                await deleteKey(childKeyId)

                // If no remaining account hangs off the same seed, sweep
                // the seed and any orphan derivation entries with it.
                const sharedSeed = remaining.some(
                    a => !!a.keyPairId && seedIdOf(a.keyPairId) === seedId,
                )
                if (!sharedSeed) {
                    await removeKeyAndChildren(seedId)
                }
            }
        }

        setAccounts([...remaining])

        // Async, non-blocking: drop the account's holdings + balance and prune
        // any now-orphaned assets/prices, then refresh caches so search stops
        // showing the removed account's assets. Failures must not surface to
        // the removal flow.
        void cleanupRemovedAccountData({ accountAddress: address })
            .then(() => {
                // Evict the gone account's own queries (e.g. its large holdings
                // page) so they don't linger in cache until gcTime. Then refresh
                // the rest: network-scoped owned-asset-ids (search), multi-account
                // aggregates, and asset metadata/prices.
                removeAccountQueriesForAddresses(queryClient, [address])
                invalidateAccountQueries(queryClient)
                invalidateAssetQueries(queryClient)
            })
            .catch(error => {
                logger.error(
                    error instanceof Error
                        ? error
                        : new Error('Account removal cleanup failed'),
                )
            })
    }
}
