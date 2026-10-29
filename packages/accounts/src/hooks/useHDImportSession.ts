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
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    handOffSecret,
    prepareHDMasterKey,
    useKMS,
} from '@perawallet/wallet-core-kms'
import { useHDImportSessionStore } from '../import-session'
import {
    selectChainNetworkId,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import {
    discoverAccounts,
    discoverWalletCandidates,
} from '../account-discovery'
import { hdPathKey } from '../hd-walk'
import {
    accountsChainAdapters,
    deriveHdAccount,
    requirePublicKeyGetter,
} from '../chain-adapter'
import type { ChainAccount, LocalAccount } from '../models'
import {
    removeUnclaimedKeys,
    useAccountsStore,
    withDefaultChains,
} from '../store'
import { HDImportSessionNotFoundError, NoHdSeedError } from '../errors'
import { findEntryHolder } from '../utils'
import { hdDiscoveryChains, hdIndexOf } from '../credentials'

export type UseHDImportSessionResult = {
    prepareImport: (params: { mnemonicIndices?: Uint16Array }) => Promise<{
        walletKeyId: string
    }>
    discoverImportAccounts: (params: {
        walletKeyId: string
    }) => Promise<LocalAccount[]>
    commitImport: (params: {
        walletKeyId: string
        selectedAccounts: LocalAccount[]
    }) => Promise<LocalAccount[]>
    cancelImport: () => void
}

export const useHDImportSession = (
    scope: ChainScope,
): UseHDImportSessionResult => {
    const { persistHDMasterKey, removeKeyAndChildren } = useKMS()
    const setAccounts = useAccountsStore(state => state.setAccounts)

    const prepareImport = useCallback(
        async ({ mnemonicIndices }: { mnemonicIndices?: Uint16Array }) => {
            const prepared = await prepareHDMasterKey({ mnemonicIndices })
            const previous = useHDImportSessionStore.getState().pending
            if (previous?.isSeedPersisted) {
                void removeKeyAndChildren(previous.walletKeyId).catch(
                    () => undefined,
                )
            }
            useHDImportSessionStore.getState().start({
                walletKeyId: prepared.keyId,
                rootKey: handOffSecret(prepared.rootKey),
                entropy: handOffSecret(prepared.entropy),
            })
            return { walletKeyId: prepared.keyId }
        },
        [removeKeyAndChildren],
    )

    const discoverImportAccounts = useCallback(
        async ({ walletKeyId }: { walletKeyId: string }) => {
            const pending = useHDImportSessionStore.getState().pending
            if (!pending || pending.walletKeyId !== walletKeyId) {
                throw new HDImportSessionNotFoundError(walletKeyId)
            }
            const chainIds = hdDiscoveryChains()
            let discovered: LocalAccount[]
            if (chainIds.length > 1) {
                // A key that derives only inside the keystore needs the seed
                // saved before it can be probed; commit skips saving it again.
                const needsKeystore = chainIds.some(
                    chainId =>
                        !accountsChainAdapters.get(chainId)
                            .createPublicKeyGetter,
                )
                if (needsKeystore && !pending.isSeedPersisted) {
                    // `persistHDMasterKey` zeroes what it is given, and the
                    // session's bytes are still needed.
                    await persistHDMasterKey({
                        keyId: pending.walletKeyId,
                        rootKey: new Uint8Array(pending.rootKey),
                        entropy: new Uint8Array(pending.entropy),
                    })
                    useHDImportSessionStore
                        .getState()
                        .markSeedPersisted(pending.walletKeyId)
                }
                discovered = await discoverWalletCandidates({
                    walletKeyId: pending.walletKeyId,
                    chainIds,
                    rootKey: pending.rootKey,
                    onUnusedKeys: removeUnclaimedKeys,
                })
            } else {
                const getPublicKey = requirePublicKeyGetter(
                    accountsChainAdapters.get(scope.chainId),
                )(pending.rootKey)
                discovered = await discoverAccounts({
                    scope,
                    getPublicKey,
                    walletKeyId: pending.walletKeyId,
                })
            }
            // Only the indexes the user can pick: one the wallet already holds
            // is shown disabled, and must not read as declined later.
            const { accounts } = useAccountsStore.getState()
            useHDImportSessionStore.getState().recordDiscovered(
                pending.walletKeyId,
                discovered.flatMap(account =>
                    findEntryHolder(accounts, account) !== undefined
                        ? []
                        : (hdIndexOf(account) ?? []),
                ),
            )
            return discovered
        },
        [scope, persistHDMasterKey],
    )

    // NOTE: `persistHDMasterKey`'s identity is unstable across renders, so
    // this `useCallback` is effectively a no-op for memoization purposes.
    // It is kept for surface consistency with the other functions returned
    // by this hook, all of which are wrapped in `useCallback`.
    const commitImport = useCallback(
        async ({
            walletKeyId,
            selectedAccounts,
        }: {
            walletKeyId: string
            selectedAccounts: LocalAccount[]
        }) => {
            const pending = useHDImportSessionStore.getState().pending
            if (!pending || pending.walletKeyId !== walletKeyId) {
                throw new HDImportSessionNotFoundError(walletKeyId)
            }

            if (!pending.isSeedPersisted) {
                await persistHDMasterKey({
                    keyId: pending.walletKeyId,
                    rootKey: pending.rootKey,
                    entropy: pending.entropy,
                })
            }

            try {
                await Promise.all(
                    selectedAccounts.map(async acc => {
                        const index = hdIndexOf(acc)
                        if (!index) {
                            throw new NoHdSeedError(pending.walletKeyId)
                        }
                        // Discovery may have dropped a candidate's key as
                        // unused mid-walk, so every key it references is
                        // derived again, which also claims it. Chains share a
                        // key, so each id is derived once, in sequence.
                        const derivedKeyIds = new Set<string>()
                        for (const [chainId, entry] of Object.entries(
                            acc.chains,
                        ) as [ChainId, ChainAccount | undefined][]) {
                            const keyPairId = entry?.keyPairId
                            if (keyPairId === undefined) continue
                            if (derivedKeyIds.has(keyPairId)) continue
                            derivedKeyIds.add(keyPairId)
                            await deriveHdAccount(
                                chainId === scope.chainId
                                    ? scope
                                    : {
                                          chainId,
                                          networkId: selectChainNetworkId(
                                              useNetworkStore.getState(),
                                              chainId,
                                          ),
                                      },
                                pending.walletKeyId,
                                index,
                            )
                        }
                    }),
                )
            } catch (e) {
                // Roll back the seed + any successfully-derived children so
                // the keystore doesn't end up with a half-imported wallet.
                // Seed ids are deterministic, but partial state would still
                // shadow a future retry's view of which children exist.
                try {
                    await removeKeyAndChildren(pending.walletKeyId)
                    // A retry must save the seed again.
                    useHDImportSessionStore
                        .getState()
                        .markSeedRemoved(pending.walletKeyId)
                } catch {
                    // Best-effort cleanup; surface the original failure.
                }
                throw e
            }

            const committed = await Promise.all(
                selectedAccounts.map(withDefaultChains),
            )
            const existing = useAccountsStore.getState().accounts
            const next = [...existing, ...committed]
            setAccounts(next)
            const selected = new Set(
                selectedAccounts.flatMap(account => {
                    const index = hdIndexOf(account)
                    return index ? [hdPathKey(index)] : []
                }),
            )
            const declinedIndexes = (pending.discoveredIndexes ?? []).filter(
                index => !selected.has(hdPathKey(index)),
            )
            // Not awaited: the walk across every chain shouldn't hold the import.
            // It gets its own copy of the root key, as the reset below zeroes the
            // session's: Algorand probes derive from it in memory rather than save
            // a key per index, and the walk zeroes it once probing ends.
            void useAccountsStore
                .getState()
                .discoverWalletAccounts(pending.walletKeyId, {
                    declinedIndexes,
                    rootKey: new Uint8Array(pending.rootKey),
                })

            useHDImportSessionStore.getState().resetState()

            return committed
        },
        [persistHDMasterKey, removeKeyAndChildren, scope, setAccounts],
    )

    const cancelImport = useCallback(() => {
        const pending = useHDImportSessionStore.getState().pending
        useHDImportSessionStore.getState().resetState()
        if (pending?.isSeedPersisted) {
            void removeKeyAndChildren(pending.walletKeyId).catch(
                () => undefined,
            )
        }
    }, [removeKeyAndChildren])

    return {
        prepareImport,
        discoverImportAccounts,
        commitImport,
        cancelImport,
    }
}
