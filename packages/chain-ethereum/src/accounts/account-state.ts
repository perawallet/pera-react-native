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
import { getAddress, InvalidAddressError, isAddress, type Address } from 'viem'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type {
    AccountChangeSignal,
    AccountsChainAdapter,
    AccountStateSnapshot,
} from '@perawallet/wallet-core-accounts'
import { upsertAssets } from '@perawallet/wallet-core-assets'
import {
    isPeraNetworkError,
    settleBatch,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { EvmChainId } from '@perawallet/wallet-core-chain-contract'
import type { EvmChain } from '../chains/types'
import {
    ASSETS_SERVICE,
    fetchWhitelist,
    NFTS_SERVICE,
} from '../assets/api/endpoints'
import { isEvmNftAssetId } from '../blockchain/utils/caip19'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import { readBalances, type HolderBalances } from '../blockchain/utils/erc20'
import {
    BLOCK_FOLLOWING_SERVICE,
    fetchShouldRefresh,
    type ShouldRefreshResponse,
} from './endpoints'
import { readNftHoldings, type NftHoldingsRead } from './nft-holdings'

export type EthereumAccountStateOps = Required<
    Pick<
        AccountsChainAdapter,
        | 'fetchAccountState'
        | 'accountExists'
        | 'checkActivity'
        | 'fetchChangeSignal'
    >
> & { readonly chainId: EvmChainId }

// The backend caches the whitelist for the same window, so a fresher read
// would see the same list.
const WHITELIST_TTL_MS = 60_000

type WhitelistEntry = { tokenIds: Promise<string[]>; fetchedAt?: number }

type ListedTokenIds = (scope: ChainScope) => Promise<string[]>

const readFootprint = async (
    ctx: ChainContext,
    chain: EvmChain,
    address: string,
    scope: ChainScope,
) => {
    const client = createEvmClient(scope, ctx, chain)
    const [balance, nonce] = await Promise.all([
        client.getBalance({ address: address as Address }),
        client.getTransactionCount({ address: address as Address }),
    ])
    return balance > 0n || nonce > 0
}

const fetchListedTokenIds =
    (chain: EvmChain): ListedTokenIds =>
    async scope => {
        const rows = await fetchWhitelist(scope, chain)
        // The native row is skipped: eth_getBalance reads it.
        return rows.filter(row => row.type === 'erc20').map(row => row.assetId)
    }

/** Concurrent reads of a scope share one request; a success is reused for the TTL, a failure is not kept. */
const cachedListedTokenIds = (
    now: () => number,
    chain: EvmChain,
): ListedTokenIds => {
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
            tokenIds: fetchListedTokenIds(chain)(scope),
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

// Undefined when the scope has no NFT service: nothing to read or keep.
type NftRead = Optional<PromiseSettledResult<NftHoldingsRead>>

const toSnapshot = (
    nativeAssetId: string,
    { wei, tokens }: HolderBalances,
    latest: number,
    pending: number,
    blockNumber: bigint,
    nfts: NftRead,
): AccountStateSnapshot => {
    const baseUnits = new Decimal(wei.toString())
    const tokenHoldings = [...tokens]
        .filter(([, balance]) => balance > 0n)
        .map(([assetId, balance]) => ({
            assetId,
            amount: new Decimal(balance.toString()),
        }))
    return {
        nativeBalanceBaseUnits: baseUnits,
        chainState: { family: 'evm', nonce: { latest, pending } },
        holdings: [
            { assetId: nativeAssetId, amount: baseUnits },
            ...tokenHoldings,
            ...(nfts?.status === 'fulfilled' ? nfts.value.holdings : []),
        ],
        observedRound: Number(blockNumber),
        // A failed NFT read keeps the stored NFTs rather than emptying the
        // gallery; ERC-20 rows still follow this read.
        ...(nfts?.status === 'rejected' && {
            unrefreshedHoldings: {
                includes: isEvmNftAssetId,
                error: nfts.reason,
            },
        }),
    }
}

// The holdings point at these rows, so they're written first; a failed write
// fails every read it carried, as the gallery can't show a holding without
// its metadata.
const persistNftReads = async (
    scope: ChainScope,
    reads: NftRead[],
): Promise<NftRead[]> => {
    const assets = reads.flatMap(read =>
        read?.status === 'fulfilled' ? read.value.assets : [],
    )
    if (assets.length === 0) return reads
    try {
        await upsertAssets({ items: assets, scope })
        return reads
    } catch (reason) {
        return reads.map(read =>
            read?.status === 'fulfilled'
                ? { status: 'rejected', reason }
                : read,
        )
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
    chain: EvmChain,
    listedTokenIds: ListedTokenIds,
    scope: ChainScope,
    reads: PendingRead[],
): Promise<void> => {
    const client = createEvmClient(scope, ctx, chain)
    const services = ctx.getPeraBackend(scope).services
    const hasWhitelist = services.has(ASSETS_SERVICE)
    // Settled per address, so one account's NFT outage never fails another's
    // read, nor its own balances.
    const nftReads: Promise<NftRead[]> = services.has(NFTS_SERVICE)
        ? Promise.allSettled(
              reads.map(({ address }) =>
                  readNftHoldings(scope, chain, address),
              ),
          ).then(settled => persistNftReads(scope, settled))
        : Promise.resolve(reads.map(() => undefined))
    const [blockNumber, tokenIds] = await Promise.all([
        client.getBlockNumber(),
        hasWhitelist ? listedTokenIds(scope) : [],
    ])
    // Issued together, so the batching transport sends the aggregates and
    // every nonce read as one request. Pinning to one block keeps balances,
    // nonces and observedRound from straddling a block boundary.
    const [balances, nonces, nfts] = await Promise.all([
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
        nftReads,
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
                chain.nativeAsset.assetId,
                balances.get(getAddress(read.address))!,
                latest,
                pending,
                blockNumber,
                nfts[index],
            ),
        )
    })
}

const coalescedAccountReads = (
    ctx: ChainContext,
    chain: EvmChain,
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
        readBatch(ctx, chain, listedTokenIds, batch.scope, batch.reads).catch(
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
    chain: EvmChain,
    scope: ChainScope,
    cursor: number | null,
): Promise<AccountChangeSignal> => {
    const head = Number(
        await createEvmClient(scope, ctx, chain).getBlockNumber(),
    )
    if (cursor === null) return { changed: true, cursor: head }
    // A lagging node can report a head behind the cursor; never move it back.
    return { changed: head > cursor, cursor: Math.max(head, cursor) }
}

const fetchChangeSignal = (
    ctx: ChainContext,
    chain: EvmChain,
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
            return readHeadSignal(ctx, chain, scope, cursor)
        }
        let answer: ShouldRefreshResponse
        try {
            answer = await fetchShouldRefresh(scope, chain, addresses, cursor)
        } catch (error) {
            if (!isRefusedCredential(error)) throw error
            refusedScopes.add(key)
            return readHeadSignal(ctx, chain, scope, cursor)
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
        return readHeadSignal(ctx, chain, scope, null)
    }
}

/**
 * `now` is the clock the whitelist cache ages by; `readWindowMs` how long a
 * read waits for others on its scope to share its block and balance pass.
 */
export const createEthereumAccountStateOps = (
    ctx: ChainContext,
    chain: EvmChain,
    {
        now = Date.now,
        readWindowMs = ACCOUNT_READ_WINDOW_MS,
    }: { now?: () => number; readWindowMs?: number } = {},
): EthereumAccountStateOps => ({
    chainId: chain.row.id,
    fetchAccountState: coalescedAccountReads(
        ctx,
        chain,
        cachedListedTokenIds(now, chain),
        readWindowMs,
    ),
    accountExists: (address, scope) =>
        readFootprint(ctx, chain, address, scope),
    checkActivity: async (addresses, scope) => {
        // A failed read beside ones that answered reads as inactive, so one
        // flaky call doesn't discard the batch's other answers.
        const active = await settleBatch(
            addresses,
            address => readFootprint(ctx, chain, address, scope),
            false,
        )
        return new Map(addresses.map((address, i) => [address, active[i]]))
    },
    fetchChangeSignal: fetchChangeSignal(ctx, chain),
})
