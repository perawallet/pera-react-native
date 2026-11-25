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
    clearProvisionalSeed,
    handOffSecret,
    markSeedProvisional,
    prepareHDMasterKey,
    useKMS,
} from '@perawallet/wallet-core-kms'
import {
    selectChainNetworkId,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useHDImportSessionStore } from '../import-session'
import {
    discardUnclaimedImportSeed,
    getPasskeyAnchorSeedIds,
} from '../import-session/provisionalImportSeeds'
import {
    discoverAccounts,
    discoverWalletCandidates,
    mergeWalletCandidates,
} from '../account-discovery'
import { hdPathKey } from '../hd-walk'
import {
    accountsChainAdapters,
    deriveHdAccount,
    requirePublicKeyGetter,
} from '../chain-adapter'
import type {
    ChainAccount,
    HdIndexLimit,
    LocalAccount,
    WalletCandidates,
    WalletDiscoveryProgress,
} from '../models'
import {
    removeUnclaimedKeys,
    useAccountsStore,
    withDefaultChains,
} from '../store'
import { HDImportSessionNotFoundError, NoHdSeedError } from '../errors'
import { importableCandidate } from '../utils'
import { hdDiscoveryChains, hdHolderAt, hdIndexOf } from '../credentials'

export type UseHDImportSessionResult = {
    prepareImport: (params: { mnemonicIndices?: Uint16Array }) => Promise<{
        walletKeyId: string
    }>
    discoverImportAccounts: (params: {
        walletKeyId: string
        /** Once aborted, no further batch is probed. */
        signal?: AbortSignal
        /** Reported only when more than one chain is discovered; a single chain has no networks to tell apart. */
        onProgress?: (progress: WalletDiscoveryProgress) => void
        /** An earlier search of this session, which a retry adds to. */
        previous?: WalletCandidates
        /** The limits `previous` stopped at; each goes one more default limit past what it found. */
        extendLimits?: readonly HdIndexLimit[]
    }) => Promise<WalletCandidates>
    commitImport: (params: {
        walletKeyId: string
        selectedAccounts: LocalAccount[]
    }) => Promise<LocalAccount[]>
    cancelImport: () => void
}

export const useHDImportSession = (
    scope: ChainScope,
): UseHDImportSessionResult => {
    const { persistHDMasterKey, mintPasskeyMainKey, removeKeyAndChildren } =
        useKMS({ getPasskeyAnchorSeedIds })
    const setAccounts = useAccountsStore(state => state.setAccounts)

    // Not surfaced: a failed removal keeps the provisional mark, so the launch
    // sweep (`sweepAbandonedImportSeeds`) retries it.
    const discardSeed = useCallback(
        (walletKeyId: string) =>
            discardUnclaimedImportSeed(walletKeyId, removeKeyAndChildren).catch(
                () => false,
            ),
        [removeKeyAndChildren],
    )

    const prepareImport = useCallback(
        async ({ mnemonicIndices }: { mnemonicIndices?: Uint16Array }) => {
            const prepared = await prepareHDMasterKey({ mnemonicIndices })
            const previous = useHDImportSessionStore.getState().pending
            if (previous?.isSeedPersisted) {
                void discardSeed(previous.walletKeyId)
            }
            useHDImportSessionStore.getState().start({
                walletKeyId: prepared.keyId,
                rootKey: handOffSecret(prepared.rootKey),
                entropy: handOffSecret(prepared.entropy),
                wordCount: mnemonicIndices?.length,
            })
            return { walletKeyId: prepared.keyId }
        },
        [discardSeed],
    )

    const discoverImportAccounts = useCallback(
        async ({
            walletKeyId,
            signal,
            onProgress,
            previous,
            extendLimits,
        }: {
            walletKeyId: string
            signal?: AbortSignal
            onProgress?: (progress: WalletDiscoveryProgress) => void
            previous?: WalletCandidates
            extendLimits?: readonly HdIndexLimit[]
        }): Promise<WalletCandidates> => {
            const pending = useHDImportSessionStore.getState().pending
            if (!pending || pending.walletKeyId !== walletKeyId) {
                throw new HDImportSessionNotFoundError(walletKeyId)
            }
            const chainIds = hdDiscoveryChains(pending.wordCount)
            let discovered: LocalAccount[]
            let failedChainIds: WalletCandidates['failedChainIds'] = []
            let isOriginFallback = false
            let reachedLimits: HdIndexLimit[] = []
            if (chainIds.length > 1) {
                const needsKeystore = chainIds.some(
                    chainId =>
                        !accountsChainAdapters.get(chainId)
                            .createPublicKeyGetter,
                )
                if (needsKeystore && !pending.isSeedPersisted) {
                    // `persistHDMasterKey` zeroes what it is given, and the
                    // session's bytes are still needed. The passkey main key
                    // waits for commit: a seed the user never confirms must
                    // not anchor it, as an app kill here would leave it there.
                    // Marked first, so a kill after the save leaves it found.
                    await markSeedProvisional(pending.walletKeyId)
                    await persistHDMasterKey(
                        {
                            keyId: pending.walletKeyId,
                            rootKey: new Uint8Array(pending.rootKey),
                            entropy: new Uint8Array(pending.entropy),
                        },
                        { shouldMintPasskeyMainKey: false },
                    )
                    // A cancel or a new prepare that landed during the save found
                    // nothing marked to remove, so the seed is dropped here.
                    if (
                        useHDImportSessionStore.getState().pending
                            ?.walletKeyId !== pending.walletKeyId
                    ) {
                        void discardSeed(pending.walletKeyId)
                        throw new HDImportSessionNotFoundError(walletKeyId)
                    }
                    useHDImportSessionStore
                        .getState()
                        .markSeedPersisted(pending.walletKeyId)
                }
                const walked = await discoverWalletCandidates({
                    walletKeyId: pending.walletKeyId,
                    chainIds,
                    rootKey: pending.rootKey,
                    onUnusedKeys: removeUnclaimedKeys,
                    signal,
                    onProgress,
                    isHeld: ({ index, derived }) =>
                        hdHolderAt(
                            useAccountsStore.getState().accounts,
                            pending.walletKeyId,
                            index,
                            derived,
                        ) !== undefined,
                    // What an earlier search found keeps the gaps open, so a
                    // deeper search carries on past it rather than stopping short.
                    heldIndexes: previous?.isOriginFallback
                        ? []
                        : (previous?.accounts ?? []).flatMap(
                              account => hdIndexOf(account) ?? [],
                          ),
                    extendLimits,
                })
                discovered = walked.accounts
                failedChainIds = walked.failedChainIds
                isOriginFallback = walked.isOriginFallback ?? false
                reachedLimits = walked.reachedLimits ?? []
                // A cancel mid-walk removed the seed while a derive was still
                // writing children under it, so they are swept once it ends.
                if (
                    useHDImportSessionStore.getState().pending?.walletKeyId !==
                    pending.walletKeyId
                ) {
                    void discardSeed(pending.walletKeyId)
                    throw new HDImportSessionNotFoundError(walletKeyId)
                }
            } else {
                const getPublicKey = requirePublicKeyGetter(
                    accountsChainAdapters.get(scope.chainId),
                )(pending.rootKey)
                discovered = await discoverAccounts({
                    scope,
                    getPublicKey,
                    walletKeyId: pending.walletKeyId,
                    signal,
                })
            }
            if (previous) {
                const merged = mergeWalletCandidates(previous, {
                    accounts: discovered,
                    failedChainIds,
                    isOriginFallback,
                    reachedLimits,
                })
                discovered = merged.accounts
                failedChainIds = merged.failedChainIds
                isOriginFallback = merged.isOriginFallback ?? false
                reachedLimits = merged.reachedLimits ?? []
            }
            // Only the indexes the user can pick: one the wallet already holds
            // is shown disabled, and must not read as declined later.
            const { accounts } = useAccountsStore.getState()
            useHDImportSessionStore.getState().recordDiscovered(
                pending.walletKeyId,
                discovered.flatMap(account =>
                    importableCandidate(accounts, account) === undefined
                        ? []
                        : (hdIndexOf(account) ?? []),
                ),
            )
            return {
                accounts: discovered,
                failedChainIds,
                isOriginFallback,
                reachedLimits,
            }
        },
        [scope, persistHDMasterKey, discardSeed],
    )

    // NOTE: `persistHDMasterKey`'s identity is unstable across renders, so the
    // `useCallback`s that depend on it (here and in `discoverImportAccounts`)
    // don't memoize; they are kept for consistency with the rest of the hook.
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

            if (selectedAccounts.length === 0) {
                useHDImportSessionStore.getState().resetState()
                if (pending.isSeedPersisted) await discardSeed(walletKeyId)
                return []
            }

            // Use copies because persisting zeroes the bytes it receives.
            if (!pending.isSeedPersisted) {
                await markSeedProvisional(pending.walletKeyId)
                await persistHDMasterKey(
                    {
                        keyId: pending.walletKeyId,
                        rootKey: new Uint8Array(pending.rootKey),
                        entropy: new Uint8Array(pending.entropy),
                    },
                    { shouldMintPasskeyMainKey: false },
                )
                useHDImportSessionStore
                    .getState()
                    .markSeedPersisted(walletKeyId)
            }

            // A single discovery chain derives on the caller's scope, as before.
            const isMultiChain = hdDiscoveryChains().length > 1
            let committed: LocalAccount[]
            try {
                const derived = await Promise.allSettled(
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
                        ) as [ChainId, Optional<ChainAccount>][]) {
                            const keyPairId = entry?.keyPairId
                            if (keyPairId === undefined) continue
                            if (derivedKeyIds.has(keyPairId)) continue
                            derivedKeyIds.add(keyPairId)
                            await deriveHdAccount(
                                isMultiChain
                                    ? {
                                          chainId,
                                          networkId: selectChainNetworkId(
                                              useNetworkStore.getState(),
                                              chainId,
                                          ),
                                      }
                                    : scope,
                                pending.walletKeyId,
                                index,
                            )
                        }
                    }),
                )
                const failure = derived.find(
                    result => result.status === 'rejected',
                )
                if (failure) throw failure.reason
                committed = await Promise.all(
                    selectedAccounts.map(withDefaultChains),
                )
            } catch (e) {
                if (await discardSeed(walletKeyId)) {
                    useHDImportSessionStore
                        .getState()
                        .markSeedRemoved(walletKeyId)
                }
                throw e
            }

            if (
                useHDImportSessionStore.getState().pending?.walletKeyId !==
                walletKeyId
            ) {
                await discardSeed(walletKeyId)
                throw new HDImportSessionNotFoundError(walletKeyId)
            }
            const existing = useAccountsStore.getState().accounts
            const next = [...existing, ...committed]
            setAccounts(next)
            clearProvisionalSeed(pending.walletKeyId)
            // The store named each account on the way in.
            const stored = useAccountsStore.getState().accounts
            const saved = committed.map(account => ({
                ...account,
                name:
                    stored.find(held => held.id === account.id)?.name ??
                    account.name,
            }))
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
            await mintPasskeyMainKey(walletKeyId)

            return saved
        },
        [
            persistHDMasterKey,
            mintPasskeyMainKey,
            discardSeed,
            scope,
            setAccounts,
        ],
    )

    const cancelImport = useCallback(() => {
        const pending = useHDImportSessionStore.getState().pending
        useHDImportSessionStore.getState().resetState()
        if (pending?.isSeedPersisted) {
            void discardSeed(pending.walletKeyId)
        }
    }, [discardSeed])

    return {
        prepareImport,
        discoverImportAccounts,
        commitImport,
        cancelImport,
    }
}
