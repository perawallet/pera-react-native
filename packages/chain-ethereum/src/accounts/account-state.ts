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

import { Decimal } from 'decimal.js'
import { formatEther, type Address } from 'viem'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type {
    AccountChangeSignal,
    AccountsChainAdapter,
    AccountStateSnapshot,
} from '@perawallet/wallet-core-accounts'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { ethereumDescriptor } from '../descriptor'
import { ASSETS_SERVICE, fetchWhitelist } from '../assets/api/endpoints'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import { readErc20Balances } from '../blockchain/utils/erc20'
import { BLOCK_FOLLOWING_SERVICE, fetchShouldRefresh } from './endpoints'

export type EthereumAccountStateOps = Required<
    Pick<
        AccountsChainAdapter,
        | 'fetchAccountState'
        | 'accountExists'
        | 'checkActivity'
        | 'fetchChangeSignal'
    >
> & { readonly chainId: typeof ETHEREUM_CHAIN_ID }

const NATIVE_ASSET_ID = ethereumDescriptor.nativeAsset.ref.assetId

// The backend caches the whitelist for the same window, so a fresher read
// would see the same list.
const WHITELIST_TTL_MS = 60_000

type WhitelistEntry = { tokenIds: Promise<string[]>; fetchedAt?: number }

type ListedTokenIds = (scope: ChainScope) => Promise<string[]>

const readFootprint = async (
    ctx: ChainContext,
    address: string,
    scope: ChainScope,
) => {
    const client = createEvmClient(scope, ctx)
    const [balance, nonce] = await Promise.all([
        client.getBalance({ address: address as Address }),
        client.getTransactionCount({ address: address as Address }),
    ])
    return balance > 0n || nonce > 0
}

const fetchListedTokenIds: ListedTokenIds = async scope => {
    const rows = await fetchWhitelist(scope)
    // The native row is skipped: eth_getBalance reads it.
    return rows.filter(row => row.type === 'erc20').map(row => row.assetId)
}

/** Concurrent reads of a scope share one request; a success is reused for the TTL, a failure is not kept. */
const cachedListedTokenIds = (now: () => number): ListedTokenIds => {
    const entries = new Map<string, WhitelistEntry>()
    return scope => {
        const key = `${scope.chainId}/${scope.networkId}`
        const cached = entries.get(key)
        if (
            cached &&
            (cached.fetchedAt === undefined ||
                now() - cached.fetchedAt < WHITELIST_TTL_MS)
        ) {
            return cached.tokenIds
        }
        const entry: WhitelistEntry = {
            tokenIds: fetchListedTokenIds(scope),
        }
        entries.set(key, entry)
        entry.tokenIds.then(
            () => {
                entry.fetchedAt = now()
            },
            () => {
                if (entries.get(key) === entry) entries.delete(key)
            },
        )
        return entry.tokenIds
    }
}

const fetchAccountState =
    (
        ctx: ChainContext,
        listedTokenIds: ListedTokenIds,
    ): EthereumAccountStateOps['fetchAccountState'] =>
    async (address, scope): Promise<AccountStateSnapshot> => {
        const client = createEvmClient(scope, ctx)
        const target = address as Address
        // A failed token read fails the whole read: the syncer replaces
        // holdings, so a native-only snapshot would drop every token.
        const hasWhitelist = ctx
            .getPeraBackend(scope)
            .services.has(ASSETS_SERVICE)
        const [blockNumber, tokenIds] = await Promise.all([
            client.getBlockNumber(),
            hasWhitelist ? listedTokenIds(scope) : [],
        ])
        // Pinning the latest reads to one block keeps balances, nonce and
        // observedRound from straddling a block boundary.
        const [wei, latest, pending, tokenBalances] = await Promise.all([
            client.getBalance({ address: target, blockNumber }),
            client.getTransactionCount({ address: target, blockNumber }),
            client.getTransactionCount({
                address: target,
                blockTag: 'pending',
            }),
            readErc20Balances(client, address, tokenIds, blockNumber),
        ])
        const baseUnits = new Decimal(wei.toString())
        const tokenHoldings = [...tokenBalances]
            .filter(([, balance]) => balance > 0n)
            .map(([assetId, balance]) => ({
                assetId,
                amount: new Decimal(balance.toString()),
                isFrozen: false,
            }))
        return {
            // formatEther is string-exact, unlike a Number division.
            nativeBalance: new Decimal(formatEther(wei)),
            nativeBalanceBaseUnits: baseUnits,
            chainState: { family: 'evm', nonce: { latest, pending } },
            minBalance: new Decimal(0),
            authorityAddress: null,
            holdings: [
                {
                    assetId: NATIVE_ASSET_ID,
                    amount: baseUnits,
                    isFrozen: false,
                },
                ...tokenHoldings,
            ],
            observedRound: Number(blockNumber),
        }
    }

const fetchChangeSignal =
    (ctx: ChainContext): EthereumAccountStateOps['fetchChangeSignal'] =>
    async (addresses, scope, cursor): Promise<AccountChangeSignal> => {
        if (ctx.getPeraBackend(scope).services.has(BLOCK_FOLLOWING_SERVICE)) {
            const answer = await fetchShouldRefresh(scope, addresses, cursor)
            if (answer.refresh && answer.round !== undefined) {
                return {
                    changed: true,
                    cursor:
                        cursor === null
                            ? answer.round
                            : Math.max(answer.round, cursor),
                }
            }
            if (!answer.refresh && cursor !== null) {
                return { changed: false, cursor }
            }
            // The backend omits round when it fails open, so the cursor
            // stays put, or seeds from the head on a never-synced scope.
            if (cursor !== null) return { changed: true, cursor }
            const head = await createEvmClient(scope, ctx).getBlockNumber()
            return { changed: true, cursor: Number(head) }
        }
        // Without block following any new block counts as a change, since
        // plain JSON-RPC can't say which addresses a block touched.
        const head = Number(await createEvmClient(scope, ctx).getBlockNumber())
        if (cursor === null) return { changed: true, cursor: head }
        // A lagging node can report a head behind the cursor; never move it back.
        return { changed: head > cursor, cursor: Math.max(head, cursor) }
    }

/** `now` is the clock the whitelist cache ages by. */
export const createEthereumAccountStateOps = (
    ctx: ChainContext,
    { now = Date.now }: { now?: () => number } = {},
): EthereumAccountStateOps => ({
    chainId: ETHEREUM_CHAIN_ID,
    fetchAccountState: fetchAccountState(ctx, cachedListedTokenIds(now)),
    accountExists: (address, scope) => readFootprint(ctx, address, scope),
    checkActivity: async (addresses, scope) =>
        new Map(
            await Promise.all(
                addresses.map(
                    async address =>
                        [
                            address,
                            await readFootprint(ctx, address, scope).catch(
                                () => false,
                            ),
                        ] as const,
                ),
            ),
        ),
    fetchChangeSignal: fetchChangeSignal(ctx),
})
