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
    addressCodecs,
    keyDerivations,
    type ChainId,
    type ChainScope,
    type DerivedKey,
    type DeriveOpts,
} from '@perawallet/wallet-core-chain-contract'
import {
    selectChainNetworkId,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { kmsCore } from '@perawallet/wallet-core-kms'
import { logger } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { AccountChains, ChainAccount, HdIndex } from './models'
import { seedMintableScheme } from './credentials'
import { accountsChainAdapters, type GetPublicKey } from './chain-adapter'

const ACCOUNT_GAP_LIMIT = 5
const KEY_INDEX_GAP_LIMIT = 5
// The wallet walk's hard stops, well past the gaps, so a node that reports
// every address active can't walk forever: every index it probes saves a key
// per chain family. A single-chain search derives in memory and stays unbounded.
const WALLET_ACCOUNT_INDEX_LIMIT = 50
const WALLET_KEY_INDEX_LIMIT = 20

/** One answer per index, in order: `true` when the index has activity. */
export type HdBatchProbe = (indices: readonly HdIndex[]) => Promise<boolean[]>

type WalkHdTreeParams = {
    probe: HdBatchProbe
    accountGapLimit?: number
    keyIndexGapLimit?: number
    /** Account indexes past this many are never probed. Unbounded by default. */
    accountIndexLimit?: number
    /** Key indexes past this many, per account index, are never probed. Unbounded by default. */
    keyIndexLimit?: number
}

type ScanLimits = {
    keyIndexGapLimit: number
    keyIndexLimit: number
    onLimit: () => void
}

export const hdPathKey = ({ account, keyIndex }: HdIndex): string =>
    `${account}/${keyIndex}`

const byPath = (a: HdIndex, b: HdIndex): number =>
    a.account !== b.account ? a.account - b.account : a.keyIndex - b.keyIndex

async function scanAccountIndex(
    account: number,
    { keyIndexGapLimit, keyIndexLimit, onLimit }: ScanLimits,
    probe: HdBatchProbe,
): Promise<HdIndex[]> {
    const active: HdIndex[] = []
    let keyGap = 0
    let keyIndex = 0

    while (keyGap < keyIndexGapLimit) {
        if (keyIndex >= keyIndexLimit) {
            onLimit()
            break
        }
        const size = Math.min(keyIndexGapLimit, keyIndexLimit - keyIndex)
        const batch = Array.from({ length: size }, (_, i) => ({
            account,
            keyIndex: keyIndex + i,
        }))
        // Inactive rather than thrown, so a dropped batch keeps the keys this
        // index already found; the gap still ends the scan.
        const results = await probe(batch).catch(() => batch.map(() => false))

        for (const [i, index] of batch.entries()) {
            if (results[i]) {
                active.push(index)
                keyGap = 0
            } else {
                keyGap++
            }
            if (keyGap >= keyIndexGapLimit) break
        }

        keyIndex += size
    }

    return active
}

/**
 * Walks an HD tree until `keyIndexGapLimit` consecutive inactive keys end an
 * account index and `accountGapLimit` consecutive account indexes with no
 * active key end the walk. A batch whose probe rejects reads as inactive.
 * Never probes past `accountIndexLimit` account indexes or
 * `keyIndexLimit` key indexes on one, warning when it stops there with the gap
 * still open. Resolves to the active indexes, by account then key index.
 */
export async function walkHdTree({
    probe,
    accountGapLimit = ACCOUNT_GAP_LIMIT,
    keyIndexGapLimit = KEY_INDEX_GAP_LIMIT,
    accountIndexLimit = Infinity,
    keyIndexLimit = Infinity,
}: WalkHdTreeParams): Promise<HdIndex[]> {
    const found: HdIndex[] = []
    let accountGap = 0
    let accountIndex = 0
    let hasHitLimit = false
    const limits: ScanLimits = {
        keyIndexGapLimit,
        keyIndexLimit,
        onLimit: () => {
            hasHitLimit = true
        },
    }

    while (accountGap < accountGapLimit) {
        if (accountIndex >= accountIndexLimit) {
            hasHitLimit = true
            break
        }
        const size = Math.min(accountGapLimit, accountIndexLimit - accountIndex)
        const results = await Promise.allSettled(
            Array.from({ length: size }, (_, i) =>
                scanAccountIndex(accountIndex + i, limits, probe),
            ),
        )

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.length > 0) {
                found.push(...result.value)
                accountGap = 0
            } else {
                accountGap++
            }
            if (accountGap >= accountGapLimit) break
        }

        accountIndex += size
    }

    if (hasHitLimit) {
        logger.warn(
            `HD walk stopped at its limit of ${accountIndexLimit} account indexes and ${keyIndexLimit} key indexes each, with activity still being found`,
        )
    }
    return found.sort(byPath)
}

export type ProbedHdIndex = {
    index: HdIndex
    /** Every chain's entry at `index`; one derived in memory has no `keyPairId`, as nothing was saved. */
    derived: AccountChains
    /** The chains with activity at `index`; empty when none or past the walk's gap. */
    active: AccountChains
}

/**
 * How far a chain answered one probed batch. `answered`: every index derived
 * and the chain answered for every address. `partial`: it answered some, but
 * an index failed to derive or the answer left an address out. `failed`: the
 * probe rejected, or no index derived.
 */
export type HdProbeOutcome = 'answered' | 'partial' | 'failed'

type DiscoverWalletActivityParams = {
    /** The seed's KMS id. */
    walletId: string
    chainIds: readonly ChainId[]
    /** Takes the keys a batch derived that no chain found active, once its probes resolve. */
    onUnusedKeys?: (keyPairIds: string[]) => Promise<void>
    /** The highest account index the wallet already holds; the walk always reaches past it. */
    heldAccountIndex?: number
    /**
     * The seed's in-memory XHD root key. A chain that derives public keys from
     * it is probed without saving a key per index; the caller keeps ownership.
     */
    rootKey?: Uint8Array
    accountGapLimit?: number
    keyIndexGapLimit?: number
    /** Called once per chain for each probed batch. */
    onProbeSettled?: (outcome: HdProbeOutcome) => void
}

/**
 * Walks a persisted seed's HD tree on every chain in `chainIds` at once: an
 * index is active when any chain reports activity there. A derivation or a
 * probe that fails reads as inactive on that chain, and `onProbeSettled`
 * says how much of it was answered. Resolves to every index
 * it probed, so the caller can drop the keys it derived for nothing.
 */
export async function discoverWalletActivity({
    walletId,
    chainIds,
    onUnusedKeys,
    heldAccountIndex = -1,
    rootKey,
    accountGapLimit = ACCOUNT_GAP_LIMIT,
    keyIndexGapLimit,
    onProbeSettled,
}: DiscoverWalletActivityParams): Promise<ProbedHdIndex[]> {
    const { chains: registry } = getProvider()
    // Filled as each key is derived, so a batch that fails later still reports
    // the keys it saved and the caller can drop them.
    const probed = new Map<string, ProbedHdIndex>()
    const probedAt = (index: HdIndex): ProbedHdIndex => {
        const key = hdPathKey(index)
        let entry = probed.get(key)
        if (!entry) {
            entry = { index, derived: {}, active: {} }
            probed.set(key, entry)
        }
        return entry
    }
    // Deriving saves the private key, and every chain of a family derives the
    // same key at an index: derive it once and build each chain's address from it.
    const keys = new Map<string, Promise<DerivedKey | undefined>>()

    const keyAt = (
        chainId: ChainId,
        { account, keyIndex }: HdIndex,
        opts: DeriveOpts,
    ): Promise<DerivedKey | undefined> => {
        const { family } = registry.get(chainId).descriptor
        const id = `${family}:${opts.scheme}:${account}/${keyIndex}`
        let key = keys.get(id)
        if (!key) {
            key = keyDerivations
                .get(chainId)
                .deriveAccount(kmsCore, walletId, account, keyIndex, opts)
                .then(
                    ({ keyPairId, publicKey }) => ({ keyPairId, publicKey }),
                    () => undefined,
                )
            keys.set(id, key)
        }
        return key
    }

    // Keystore saves are slow on device, so a chain that can derive in memory
    // never goes through one; only the keys the caller adds get saved.
    const getters = new Map<ChainId, GetPublicKey | undefined>()
    const inMemoryGetter = (chainId: ChainId): GetPublicKey | undefined => {
        if (!rootKey) return undefined
        if (!getters.has(chainId)) {
            getters.set(
                chainId,
                accountsChainAdapters
                    .get(chainId)
                    .createPublicKeyGetter?.(rootKey),
            )
        }
        return getters.get(chainId)
    }

    const deriveOn = async (
        scope: ChainScope,
        indices: readonly HdIndex[],
    ): Promise<(ChainAccount | undefined)[]> => {
        const scheme = seedMintableScheme(scope.chainId)
        if (scheme === undefined) return indices.map(() => undefined)
        const opts = { scheme, networkId: scope.networkId }
        const codec = addressCodecs.get(scope.chainId)
        const getPublicKey = inMemoryGetter(scope.chainId)
        const entries: (ChainAccount | undefined)[] = []
        for (const index of indices) {
            if (getPublicKey) {
                const publicKey = await getPublicKey(index).catch(
                    () => undefined,
                )
                const entry = publicKey && {
                    address: codec.fromPublicKey(publicKey, opts),
                }
                if (entry) probedAt(index).derived[scope.chainId] = entry
                entries.push(entry)
                continue
            }
            const key = await keyAt(scope.chainId, index, opts)
            if (!key) {
                entries.push(undefined)
                continue
            }
            const entry = {
                address: codec.fromPublicKey(key.publicKey, opts),
                keyPairId: key.keyPairId,
            }
            probedAt(index).derived[scope.chainId] = entry
            entries.push(entry)
        }
        return entries
    }

    const probeChain = async (
        scope: ChainScope,
        entries: (ChainAccount | undefined)[],
    ): Promise<(ChainAccount | undefined)[]> => {
        const addresses = entries.flatMap(entry =>
            entry ? [entry.address] : [],
        )
        if (addresses.length === 0) {
            onProbeSettled?.('failed')
            return entries.map(() => undefined)
        }
        let activity: Map<string, boolean>
        try {
            activity = await accountsChainAdapters
                .get(scope.chainId)
                .checkActivity(addresses, scope)
        } catch {
            onProbeSettled?.('failed')
            return entries.map(() => undefined)
        }
        const isComplete =
            addresses.length === entries.length &&
            addresses.every(address => activity.has(address))
        onProbeSettled?.(isComplete ? 'answered' : 'partial')
        return entries.map(entry =>
            entry && activity.get(entry.address) === true ? entry : undefined,
        )
    }

    const probe: HdBatchProbe = async indices => {
        const derivedPerChain: {
            scope: ChainScope
            entries: (ChainAccount | undefined)[]
        }[] = []
        for (const chainId of chainIds) {
            const scope = {
                chainId,
                networkId: selectChainNetworkId(
                    useNetworkStore.getState(),
                    chainId,
                ),
            }
            derivedPerChain.push({
                scope,
                entries: await deriveOn(scope, indices),
            })
        }
        const activePerChain = await Promise.all(
            derivedPerChain.map(({ scope, entries }) =>
                probeChain(scope, entries),
            ),
        )
        const unused = new Set<string>()
        const results = indices.map((index, i) => {
            const { active, derived } = probedAt(index)
            for (const [c, chainId] of chainIds.entries()) {
                const activeEntry = activePerChain[c][i]
                if (activeEntry) active[chainId] = activeEntry
            }
            const kept = new Set(
                Object.values(active).map(entry => entry?.keyPairId),
            )
            for (const entry of Object.values(derived)) {
                const keyPairId = entry?.keyPairId
                if (keyPairId !== undefined && !kept.has(keyPairId)) {
                    unused.add(keyPairId)
                }
            }
            return Object.keys(active).length > 0
        })
        // Every derive saves a private key, and the walk runs unawaited: an app
        // killed before it ends would leave them in secure storage for good.
        // Dropping each batch's unused keys here narrows that to the active
        // ones, which live only until the walk stores their accounts.
        if (onUnusedKeys && unused.size > 0) {
            await onUnusedKeys([...unused]).catch(() => undefined)
        }
        return results
    }

    const walked = new Set(
        (
            await walkHdTree({
                probe,
                accountGapLimit,
                keyIndexGapLimit,
                accountIndexLimit: Math.max(
                    WALLET_ACCOUNT_INDEX_LIMIT,
                    heldAccountIndex + 1 + accountGapLimit,
                ),
                keyIndexLimit: WALLET_KEY_INDEX_LIMIT,
            })
        ).map(hdPathKey),
    )

    return [...probed.values()]
        .map(entry =>
            walked.has(hdPathKey(entry.index))
                ? entry
                : { ...entry, active: {} },
        )
        .sort((a, b) => byPath(a.index, b.index))
}
