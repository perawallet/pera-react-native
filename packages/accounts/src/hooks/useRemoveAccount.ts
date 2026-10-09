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
import type { WalletAccount } from '../models'
import { isKeyReferenced } from '../credentials'
import { cleanupRemovedAccountData } from '../cleanup'
import {
    invalidateAccountQueries,
    removeAccountQueriesForAddresses,
} from './querykeys'

export const useRemoveAccount = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const { deleteKey, seedIdOf, removeKeyAndChildren } = useKMS()
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const queryClient = useQueryClient()

    return async (id: string) => {
        const account = accounts.find(a => a.id === id)
        const remaining = accounts.filter(a => a.id !== id)
        const keyIdsOf = (a: WalletAccount) =>
            Object.values(a.chains).flatMap(entry => entry?.keyPairId ?? [])

        const keyIds = account ? keyIdsOf(account) : []
        // Resolve every seed first: deleting a child drops its parent link.
        const childKeys = keyIds.flatMap(childKeyId => {
            const seedId = seedIdOf(childKeyId)
            return seedId ? [{ childKeyId, seedId }] : []
        })
        // A standalone account's raw key has no seed above it, so nothing
        // else would sweep it.
        const rawKeys =
            account?.custody.kind === 'local' && account.custody.seed === null
                ? keyIds.filter(
                      keyId =>
                          !childKeys.some(
                              ({ childKeyId }) => childKeyId === keyId,
                          ) && !isKeyReferenced(remaining, keyId),
                  )
                : []
        for (const keyId of rawKeys) {
            await deleteKey(keyId)
        }
        // This account's own derived children: no other account references them.
        for (const { childKeyId } of childKeys) {
            await deleteKey(childKeyId)
        }
        // A seed no remaining account hangs off goes too, with any orphan
        // derivation entries.
        const seeds = new Set(childKeys.map(({ seedId }) => seedId))
        for (const seedId of seeds) {
            const sharedSeed = remaining.some(a =>
                keyIdsOf(a).some(keyId => seedIdOf(keyId) === seedId),
            )
            if (!sharedSeed) {
                await removeKeyAndChildren(seedId)
            }
        }

        setAccounts([...remaining])

        const addresses = account
            ? Object.values(account.chains).flatMap(
                  entry => entry?.address ?? [],
              )
            : []
        // Async, non-blocking: drop the account's holdings + balance and prune
        // any now-orphaned assets/prices, then refresh caches so search stops
        // showing the removed account's assets. Failures must not surface to
        // the removal flow.
        const cleanup = async () => {
            // One at a time: every cleanup writes through the one database connection.
            for (const accountAddress of addresses) {
                await cleanupRemovedAccountData({ accountAddress })
            }
        }
        void cleanup()
            .then(() => {
                // Evict the gone account's own queries (e.g. its large holdings
                // page) so they don't linger in cache until gcTime. Then refresh
                // the rest: network-scoped owned-asset-ids (search), multi-account
                // aggregates, and asset metadata/prices.
                removeAccountQueriesForAddresses(queryClient, addresses)
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
