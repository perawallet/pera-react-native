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

import { getAddress, type Address } from 'viem'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { AccountsChainAdapter } from '@perawallet/wallet-core-accounts'
import {
    createConcurrencyLimit,
    isChainRefusedError,
    logger,
    PeraServiceUnavailableError,
    type ConcurrencyLimit,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { EvmChain } from '../chains/types'
import {
    ASSETS_SERVICE,
    fetchHasNftHoldings,
    NFTS_SERVICE,
} from '../assets/api/endpoints'
import type { ListedTokenIds } from '../assets/api/whitelist-cache'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import { readBalances } from '../blockchain/utils/erc20'
import { fetchHasHistory, HISTORY_SERVICE } from '../history/api/endpoints'

/** True when the native balance or the latest nonce is above zero. */
export const readNativeFootprint = async (
    ctx: ChainContext,
    chain: EvmChain,
    address: string,
    scope: ChainScope,
): Promise<boolean> => {
    const client = createEvmClient(scope, ctx, chain)
    const [balance, nonce] = await Promise.all([
        client.getBalance({ address: address as Address }),
        client.getTransactionCount({ address: address as Address }),
    ])
    return balance > 0n || nonce > 0
}

type Quiet = { address: string; index: number }

// One gate for every EVM chain: the HD walk probes all of them and several
// index batches at once, and each quiet address costs a Pera GET, so a
// per-batch cap would still burst into the backend's rate limit.
const PERA_LOOKUP_CONCURRENCY = 4
let peraLookupGate: Optional<ConcurrencyLimit>
// Built on first use, so importing the adapter runs nothing.
const gatedPeraLookup: ConcurrencyLimit = task => {
    peraLookupGate ??= createConcurrencyLimit(PERA_LOOKUP_CONCURRENCY)
    return peraLookupGate(task)
}

// A walk that gave up on the chain aborts `signal`: the lookups still queued
// then skip their request instead of holding a slot a healthy chain needs.
const peraLookup = (
    signal: Optional<AbortSignal>,
    lookup: () => Promise<boolean>,
): Promise<boolean> =>
    gatedPeraLookup(() =>
        signal?.aborted
            ? Promise.reject(new Error('Activity lookup abandoned'))
            : lookup(),
    )

/**
 * One Multicall3 pass over the listed ERC-20s for `holders`: whether each
 * holds any. Rejects when the whitelist, the block or the pass fails.
 */
const readTokenHoldings = async (
    ctx: ChainContext,
    chain: EvmChain,
    listedTokenIds: ListedTokenIds,
    scope: ChainScope,
    holders: string[],
): Promise<boolean[]> => {
    const tokenIds = await listedTokenIds(scope)
    if (tokenIds.length === 0) return holders.map(() => false)
    const client = createEvmClient(scope, ctx, chain)
    const balances = await readBalances(
        client,
        holders,
        tokenIds,
        await client.getBlockNumber(),
    )
    return holders.map(holder =>
        [...(balances.get(getAddress(holder))?.tokens.values() ?? [])].some(
            balance => balance > 0n,
        ),
    )
}

/**
 * Whether each address has any on-chain footprint, for HD discovery. An
 * address counts as used with a native balance or a nonce, and past that with
 * Pera history for it or, on a scope with no history service, a current
 * listed ERC-20 or NFT holding. Once `signal` aborts, Pera lookups not yet
 * sent are skipped.
 *
 * Each address costs two node reads (balance, nonce) and at most one Pera GET
 * (a history page or an NFT page, never a cursor), plus a share of one
 * Multicall3 pass per batch; never a request per token. The Pera GETs share
 * one in-flight cap across every EVM chain.
 *
 * A read that fails never reads as `true` or `false`: its address is left out
 * of the map unless another source already found it used. The batch rejects
 * when no address got an answer, or with the backend's refusal when it has
 * the chain switched off.
 */
export const createEvmActivityCheck =
    (
        ctx: ChainContext,
        chain: EvmChain,
        listedTokenIds: ListedTokenIds,
    ): AccountsChainAdapter['checkActivity'] =>
    async (addresses, scope, signal) => {
        // Answering over RPC alone would list a network the backend refuses.
        if (ctx.getPeraBackend(scope).isChainRefused === true) {
            throw new PeraServiceUnavailableError(scope, undefined, {
                isChainRefused: true,
            })
        }
        const errors: unknown[] = []
        // One entry per source that applies; undefined when it could not answer.
        const answers = addresses.map((): Optional<boolean>[] => [])
        const take = (
            index: number,
            result: PromiseSettledResult<boolean>,
        ): void => {
            if (result.status === 'rejected') errors.push(result.reason)
            answers[index]!.push(
                result.status === 'fulfilled' ? result.value : undefined,
            )
        }

        const footprints = await Promise.allSettled(
            addresses.map(address =>
                readNativeFootprint(ctx, chain, address, scope),
            ),
        )
        footprints.forEach((result, index) => take(index, result))

        const quiet: Quiet[] = addresses.flatMap((address, index) =>
            answers[index]![0] === true ? [] : [{ address, index }],
        )
        const takeAll = (results: PromiseSettledResult<boolean>[]): void =>
            results.forEach((result, k) => take(quiet[k]!.index, result))

        if (quiet.length > 0) {
            const { services } = ctx.getPeraBackend(scope)
            if (services.has(HISTORY_SERVICE)) {
                takeAll(
                    await Promise.allSettled(
                        quiet.map(({ address }) =>
                            peraLookup(signal, () =>
                                fetchHasHistory(scope, chain, address, signal),
                            ),
                        ),
                    ),
                )
            } else {
                const sources: Promise<void>[] = []
                if (services.has(ASSETS_SERVICE)) {
                    sources.push(
                        readTokenHoldings(
                            ctx,
                            chain,
                            listedTokenIds,
                            scope,
                            quiet.map(({ address }) => address),
                        ).then(
                            held =>
                                takeAll(
                                    held.map(value => ({
                                        status: 'fulfilled',
                                        value,
                                    })),
                                ),
                            (reason: unknown) =>
                                takeAll(
                                    quiet.map(() => ({
                                        status: 'rejected',
                                        reason,
                                    })),
                                ),
                        ),
                    )
                }
                if (services.has(NFTS_SERVICE)) {
                    sources.push(
                        Promise.allSettled(
                            quiet.map(({ address }) =>
                                peraLookup(signal, () =>
                                    fetchHasNftHoldings(
                                        scope,
                                        chain,
                                        address,
                                        signal,
                                    ),
                                ),
                            ),
                        ).then(takeAll),
                    )
                }
                await Promise.all(sources)
            }
        }

        // The backend switched this chain off: no rerun can answer for it,
        // so the walk is told the chain is refused rather than unanswered.
        const refusal = errors.find(isChainRefusedError)
        if (refusal) throw refusal

        const active = new Map<string, boolean>()
        addresses.forEach((address, index) => {
            const given = answers[index]!
            if (given.includes(true)) active.set(address, true)
            else if (!given.includes(undefined)) active.set(address, false)
        })
        if (addresses.length > 0 && active.size === 0) {
            throw errors[0] ?? new Error('No address could be checked')
        }
        if (active.size < addresses.length) {
            logger.warn('EVM activity check left addresses unanswered', {
                chainId: scope.chainId,
                unanswered: addresses.length - active.size,
                error: errors[0],
            })
        }
        return active
    }
