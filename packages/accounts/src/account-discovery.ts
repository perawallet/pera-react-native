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
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { mapWithConcurrency } from '@perawallet/wallet-core-shared'
import type { AccountChains, LocalAccount, WalletAccount } from './models'
import {
    buildAccount,
    isEnabledByDefault,
    preferDefaultChain,
    withEnablement,
} from './credentials'
import { recordAuthority } from './store/recordAuthority'
import {
    accountsChainAdapters,
    fetchDelegatedAddresses,
    hdDeriveOpts,
    type GetPublicKey,
} from './chain-adapter'
import {
    discoverWalletActivity,
    hdPathKey,
    walkHdTree,
    type HdBatchProbe,
    type ProbedHdIndex,
} from './hd-walk'

type DiscoverAccountsParams = {
    scope: ChainScope
    getPublicKey: GetPublicKey
    walletKeyId: string
    accountGapLimit?: number
    keyIndexGapLimit?: number
}

export async function discoverAccounts({
    scope,
    getPublicKey,
    walletKeyId,
    accountGapLimit,
    keyIndexGapLimit,
}: DiscoverAccountsParams): Promise<LocalAccount[]> {
    const adapter = accountsChainAdapters.get(scope.chainId)
    const codec = addressCodecs.get(scope.chainId)
    const deriveOpts = hdDeriveOpts(scope)
    const addressOf = (account: WalletAccount) =>
        account.chains[scope.chainId]?.address ?? ''
    const built = new Map<string, LocalAccount>()
    let hasProbeResolved = false

    const probe: HdBatchProbe = async indices => {
        const accounts: LocalAccount[] = []
        for (const hd of indices) {
            const address = codec.fromPublicKey(
                await getPublicKey(hd),
                deriveOpts,
            )
            const account = buildAccount({
                custody: { kind: 'local', seed: 'bip39', hd },
                chainId: adapter.chainId,
                chains: {
                    [adapter.chainId]: {
                        address,
                        keyPairId: adapter.hdKeyPairId(walletKeyId, hd),
                    },
                },
            })
            built.set(hdPathKey(hd), account)
            accounts.push(account)
        }
        const activity = await adapter.checkActivity(
            accounts.map(addressOf),
            scope,
        )
        hasProbeResolved = true
        return accounts.map(
            account => activity.get(addressOf(account)) ?? false,
        )
    }

    const active = await walkHdTree({
        probe,
        accountGapLimit,
        keyIndexGapLimit,
    })

    // With no probe answered, "no activity" is unknown, not empty: return
    // nothing so the caller fails rather than offering 0/0 as the whole seed.
    if (!hasProbeResolved) return []
    if (active.length === 0) {
        const zeroAccount = built.get(hdPathKey({ account: 0, keyIndex: 0 }))
        return zeroAccount ? [zeroAccount] : []
    }

    return active.map(index => built.get(hdPathKey(index))!)
}

type DiscoverWalletCandidatesParams = {
    walletKeyId: string
    chainIds: readonly ChainId[]
    /** The in-memory XHD root; the caller keeps ownership. */
    rootKey?: Uint8Array
    onUnusedKeys?: (keyPairIds: string[]) => Promise<void>
}

/**
 * Walks the seed on every chain in `chainIds` at once and returns one unsaved
 * account per index active on any of them, by path: the 0/0 account alone when
 * none is. Each carries an entry on every default chain plus every chain it is
 * active on. `walletKeyId` must already be in the keystore when a chain in
 * `chainIds` has no in-memory public-key getter. Empty when no probe answered,
 * as "no activity" is unknown then.
 */
export async function discoverWalletCandidates({
    walletKeyId,
    chainIds,
    rootKey,
    onUnusedKeys,
}: DiscoverWalletCandidatesParams): Promise<LocalAccount[]> {
    let hasProbeAnswered = false
    const probed = await discoverWalletActivity({
        walletId: walletKeyId,
        chainIds,
        rootKey,
        onUnusedKeys,
        onProbeAnswered: () => {
            hasProbeAnswered = true
        },
    })
    if (!hasProbeAnswered) return []

    const isActive = ({ active }: ProbedHdIndex) =>
        Object.keys(active).length > 0
    const origin = (entry: ProbedHdIndex) =>
        entry.index.account === 0 && entry.index.keyIndex === 0
    const selected = probed.some(isActive)
        ? probed.filter(isActive)
        : probed.filter(origin)

    return selected.flatMap(({ index, derived, active }) => {
        const chains: AccountChains = {}
        for (const chainId of chainIds) {
            const activeEntry = active[chainId]
            const derivedEntry = derived[chainId]
            const entry =
                activeEntry ??
                (isEnabledByDefault(chainId) ? derivedEntry : undefined)
            if (!entry) continue
            const keyed = {
                address: entry.address,
                keyPairId: accountsChainAdapters
                    .get(chainId)
                    .hdKeyPairId(walletKeyId, index),
            }
            chains[chainId] = isEnabledByDefault(chainId)
                ? keyed
                : withEnablement(keyed, 'discovery')
        }
        const chainId = preferDefaultChain(Object.keys(chains) as ChainId[])
        if (chainId === undefined) return []
        return [
            buildAccount({
                custody: { kind: 'local', seed: 'bip39', hd: index },
                chainId,
                chains,
            }),
        ]
    })
}

type DiscoverDelegatedAccountsParams = {
    /**
     * Authority addresses to scan: every on-chain account whose authority is
     * one of these is returned as a watch-account candidate labeled with it.
     */
    accountAddresses: string[]
    scope: ChainScope
}

// A rescan passes every address on the seed, and each scan may follow several
// pages, so they run a few at a time rather than all at once.
const DELEGATION_SCAN_CONCURRENCY = 4

/**
 * Address-driven: every caller passes the authorities to scan. Rejects with
 * the first failure once every scan settles, so a lost answer never reads as
 * "nothing delegated".
 */
export async function discoverDelegatedAccounts({
    accountAddresses,
    scope,
}: DiscoverDelegatedAccountsParams): Promise<WalletAccount[]> {
    const { chainId } = scope

    const results = await mapWithConcurrency(
        accountAddresses,
        DELEGATION_SCAN_CONCURRENCY,
        async address => {
            const delegatedAddresses = await fetchDelegatedAddresses(
                address,
                scope,
            )

            return delegatedAddresses.map((delegatedAddress): WalletAccount => {
                recordAuthority(scope, delegatedAddress, address)
                return buildAccount({
                    custody: { kind: 'watch' },
                    chainId,
                    chains: { [chainId]: { address: delegatedAddress } },
                })
            })
        },
    )

    return results.flatMap(result => {
        if (result.status === 'rejected') throw result.reason
        return result.value
    })
}
