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
    isChainRefusedError,
    logger,
    PeraServiceUnavailableError,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { EvmChain } from '../chains/types'
import { ASSETS_SERVICE } from '../assets/api/endpoints'
import type { ListedTokenIds } from '../assets/api/whitelist-cache'
import { toRpcTransportError } from '../blockchain/errors/toRpcTransportError'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import { readBalances } from '../blockchain/utils/erc20'
import { withDiscoveryReadCeiling } from './discovery-bounds'

/**
 * True when the native balance or the latest nonce is above zero. A node that
 * didn't answer rejects with a typed network error, so the walk can tell a
 * temporary failure from a broken request.
 */
export const readNativeFootprint = async (
    ctx: Pick<ChainContext, 'getEndpoints' | 'timeouts'>,
    chain: EvmChain,
    address: string,
    scope: ChainScope,
): Promise<boolean> => {
    const client = createEvmClient(scope, ctx, chain)
    try {
        const [balance, nonce] = await Promise.all([
            client.getBalance({ address: address as Address }),
            client.getTransactionCount({ address: address as Address }),
        ])
        return balance > 0n || nonce > 0
    } catch (error) {
        throw toRpcTransportError(error) ?? error
    }
}

type Quiet = { address: string; index: number }

/**
 * One Multicall3 pass over the listed ERC-20s for `holders`: whether each
 * holds any. Rejects when the whitelist, the block or the pass fails.
 */
const readTokenHoldings = async (
    ctx: Pick<ChainContext, 'getEndpoints' | 'timeouts'>,
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
 * a current listed ERC-20 holding.
 *
 * Each address costs two node reads (balance, nonce) plus a share of one
 * Multicall3 pass per batch; never a Pera request or a request per token.
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
    async (addresses, scope) => {
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

        const discoveryReadCtx = withDiscoveryReadCeiling(ctx)
        const footprints = await Promise.allSettled(
            addresses.map(address =>
                readNativeFootprint(discoveryReadCtx, chain, address, scope),
            ),
        )
        footprints.forEach((result, index) => take(index, result))

        const quiet: Quiet[] = addresses.flatMap((address, index) =>
            answers[index]![0] === true ? [] : [{ address, index }],
        )
        const takeAll = (results: PromiseSettledResult<boolean>[]): void =>
            results.forEach((result, k) => take(quiet[k]!.index, result))

        // No Pera reads: history and NFT holdings each have a per-device limit
        // an import would spend. Only an address that never sent and holds
        // nothing listed goes unseen.
        if (
            quiet.length > 0 &&
            ctx.getPeraBackend(scope).services.has(ASSETS_SERVICE)
        ) {
            await readTokenHoldings(
                discoveryReadCtx,
                chain,
                listedTokenIds,
                scope,
                quiet.map(({ address }) => address),
            ).then(
                held =>
                    takeAll(
                        held.map(value => ({ status: 'fulfilled', value })),
                    ),
                (reason: unknown) =>
                    takeAll(quiet.map(() => ({ status: 'rejected', reason }))),
            )
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
