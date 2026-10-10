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
import {
    formatEther,
    getAddress,
    InvalidAddressError,
    isAddress,
    type Address,
} from 'viem'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type {
    AccountChangeSignal,
    AccountsChainAdapter,
    AccountStateSnapshot,
} from '@perawallet/wallet-core-accounts'
import { isPeraNetworkError } from '@perawallet/wallet-core-shared'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { ethereumDescriptor } from '../descriptor'
import { ASSETS_SERVICE, fetchWhitelist } from '../assets/api/endpoints'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import { readBalances, type HolderBalances } from '../blockchain/utils/erc20'
import {
    BLOCK_FOLLOWING_SERVICE,
    fetchShouldRefresh,
    type ShouldRefreshResponse,
} from './endpoints'

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

// Reads arriving within this window share one block and one Multicall3 pass.
// The syncer awaits a database read before each account, so its reads for one
// scope land a few milliseconds apart rather than in the same tick.
const ACCOUNT_READ_WINDOW_MS = 10

type PendingRead = {
    address: string
    resolve: (snapshot: AccountStateSnapshot) => void
    reject: (error: unknown) => void
}

const toSnapshot = (
    { wei, tokens }: HolderBalances,
    latest: number,
    pending: number,
    blockNumber: bigint,
): AccountStateSnapshot => {
    const baseUnits = new Decimal(wei.toString())
    const tokenHoldings = [...tokens]
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
            { assetId: NATIVE_ASSET_ID, amount: baseUnits, isFrozen: false },
            ...tokenHoldings,
        ],
        observedRound: Number(blockNumber),
    }
}

/**
 * One block and one balance pass for every read in the batch; a failed block,
 * whitelist or balance read rejects them all, since the syncer replaces
 * holdings and a native-only snapshot would drop every token. Only the nonce
 * reads fail per account.
 */
const readBatch = async (
    ctx: ChainContext,
    listedTokenIds: ListedTokenIds,
    scope: ChainScope,
    reads: PendingRead[],
): Promise<void> => {
    const client = createEvmClient(scope, ctx)
    const hasWhitelist = ctx.getPeraBackend(scope).services.has(ASSETS_SERVICE)
    const [blockNumber, tokenIds] = await Promise.all([
        client.getBlockNumber(),
        hasWhitelist ? listedTokenIds(scope) : [],
    ])
    // Issued together, so the batching transport sends the aggregates and
    // every nonce read as one request. Pinning to one block keeps balances,
    // nonces and observedRound from straddling a block boundary.
    const [balances, nonces] = await Promise.all([
        readBalances(
            client,
            reads.map(read => read.address),
            tokenIds,
            blockNumber,
        ),
        Promise.allSettled(
            reads.map(({ address }) =>
                Promise.all([
                    client.getTransactionCount({
                        address: address as Address,
                        blockNumber,
                    }),
                    client.getTransactionCount({
                        address: address as Address,
                        blockTag: 'pending',
                    }),
                ]),
            ),
        ),
    ])
    reads.forEach((read, index) => {
        const nonce = nonces[index]!
        if (nonce.status === 'rejected') {
            read.reject(nonce.reason)
            return
        }
        const [latest, pending] = nonce.value
        read.resolve(
            toSnapshot(
                balances.get(getAddress(read.address))!,
                latest,
                pending,
                blockNumber,
            ),
        )
    })
}

const coalescedAccountReads = (
    ctx: ChainContext,
    listedTokenIds: ListedTokenIds,
    windowMs: number,
): EthereumAccountStateOps['fetchAccountState'] => {
    const batches = new Map<
        string,
        { scope: ChainScope; reads: PendingRead[] }
    >()
    const flush = (key: string) => {
        const batch = batches.get(key)
        batches.delete(key)
        if (!batch) return
        readBatch(ctx, listedTokenIds, batch.scope, batch.reads).catch(
            (error: unknown) => {
                batch.reads.forEach(read => read.reject(error))
            },
        )
    }
    return (address, scope) =>
        new Promise<AccountStateSnapshot>((resolve, reject) => {
            // Rejected alone: in the batch, one bad address would fail every
            // read sharing its balance pass.
            if (!isAddress(address)) {
                reject(new InvalidAddressError({ address }))
                return
            }
            const key = `${scope.chainId}/${scope.networkId}`
            let batch = batches.get(key)
            if (!batch) {
                batch = { scope, reads: [] }
                batches.set(key, batch)
                setTimeout(() => flush(key), windowMs)
            }
            batch.reads.push({ address, resolve, reject })
        })
}

const isRefusedCredential = (error: unknown): boolean =>
    isPeraNetworkError(error) && (error.status === 401 || error.status === 403)

const readHeadSignal = async (
    ctx: ChainContext,
    scope: ChainScope,
    cursor: number | null,
): Promise<AccountChangeSignal> => {
    const head = Number(await createEvmClient(scope, ctx).getBlockNumber())
    if (cursor === null) return { changed: true, cursor: head }
    // A lagging node can report a head behind the cursor; never move it back.
    return { changed: head > cursor, cursor: Math.max(head, cursor) }
}

const fetchChangeSignal = (
    ctx: ChainContext,
): EthereumAccountStateOps['fetchChangeSignal'] => {
    // A refused key or integrity token won't fix itself before a restart, so
    // the scope stops asking and follows the RPC head instead.
    const refusedScopes = new Set<string>()
    return async (addresses, scope, cursor) => {
        const key = `${scope.chainId}/${scope.networkId}`
        if (
            refusedScopes.has(key) ||
            !ctx.getPeraBackend(scope).services.has(BLOCK_FOLLOWING_SERVICE)
        ) {
            // Plain JSON-RPC can't say which addresses a block touched, so
            // any new block counts as a change.
            return readHeadSignal(ctx, scope, cursor)
        }
        let answer: ShouldRefreshResponse
        try {
            answer = await fetchShouldRefresh(scope, addresses, cursor)
        } catch (error) {
            if (!isRefusedCredential(error)) throw error
            refusedScopes.add(key)
            return readHeadSignal(ctx, scope, cursor)
        }
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
        // The backend omits round when it fails open, so the cursor stays
        // put, or seeds from the head on a never-synced scope.
        if (cursor !== null) return { changed: true, cursor }
        return readHeadSignal(ctx, scope, null)
    }
}

/**
 * `now` is the clock the whitelist cache ages by; `readWindowMs` how long a
 * read waits for others on its scope to share its block and balance pass.
 */
export const createEthereumAccountStateOps = (
    ctx: ChainContext,
    {
        now = Date.now,
        readWindowMs = ACCOUNT_READ_WINDOW_MS,
    }: { now?: () => number; readWindowMs?: number } = {},
): EthereumAccountStateOps => ({
    chainId: ETHEREUM_CHAIN_ID,
    fetchAccountState: coalescedAccountReads(
        ctx,
        cachedListedTokenIds(now),
        readWindowMs,
    ),
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
