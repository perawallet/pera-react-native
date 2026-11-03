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
import {
    getAccountHeldAssets,
    type AccountChangeSignal,
    type AccountsChainAdapter,
    type AccountStateSnapshot,
    type UnrefreshedHoldings,
} from '@perawallet/wallet-core-accounts'
import { upsertAssets } from '@perawallet/wallet-core-assets'
import {
    isPeraNetworkError,
    isPeraServiceUnavailableError,
    logger,
    PeraServiceUnavailableError,
    type Optional,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { EvmChainId } from '@perawallet/wallet-core-chain-contract'
import type { EvmChain } from '../chains/types'
import { ASSETS_SERVICE, NFTS_SERVICE } from '../assets/api/endpoints'
import {
    cachedWhitelist,
    listedTokenIds,
    type ListedTokenIds,
    type ListedTokens,
} from '../assets/api/whitelist-cache'
import { isEvmNftAssetId } from '../blockchain/utils/caip19'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import { readBalances, type HolderBalances } from '../blockchain/utils/erc20'
import {
    BLOCK_FOLLOWING_SERVICE,
    fetchShouldRefresh,
    type ShouldRefreshResponse,
} from './endpoints'
import { createEvmActivityCheck, readNativeFootprint } from './activity'
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

// Reads arriving within this window share one block and one Multicall3 pass.
// The syncer awaits a database read before each account, so its reads for one
// scope land a few milliseconds apart rather than in the same tick.
const ACCOUNT_READ_WINDOW_MS = 10

type PendingRead = {
    address: string
    addedTokenIds: readonly string[]
    resolve: (snapshot: AccountStateSnapshot) => void
    reject: (error: unknown) => void
}

// Undefined when the scope has no NFT service: nothing was read.
type NftRead = Optional<PromiseSettledResult<NftHoldingsRead>>

/**
 * Stored rows this read had no source for: a scope without the token list
 * can't say which tokens an account holds beyond the ones the user added, and
 * one without the NFT service (or whose NFT read failed) can't list its NFTs.
 * Kept as they are, so a Pera backend that is off doesn't empty the account.
 */
// One entry per account whose read skipped what only the token list gives.
const backfillKey = (scope: ChainScope, address: string): string =>
    `${scope.chainId}/${scope.networkId}/${address.toLowerCase()}`

const unrefreshedOf = (
    scope: ChainScope,
    services: ReadonlySet<string>,
    nativeAssetId: string,
    readTokenIds: ReadonlySet<string>,
    nfts: NftRead,
): Optional<UnrefreshedHoldings> => {
    const missed: UnrefreshedHoldings[] = []
    if (!services.has(ASSETS_SERVICE)) {
        missed.push({
            includes: assetId =>
                assetId !== nativeAssetId &&
                !isEvmNftAssetId(assetId) &&
                !readTokenIds.has(
                    isAddress(assetId) ? getAddress(assetId) : assetId,
                ),
            error: new PeraServiceUnavailableError(scope, ASSETS_SERVICE),
        })
    }
    if (!services.has(NFTS_SERVICE)) {
        missed.push({
            includes: isEvmNftAssetId,
            error: new PeraServiceUnavailableError(scope, NFTS_SERVICE),
        })
    } else if (nfts?.status === 'rejected') {
        // A failed NFT read keeps the stored NFTs rather than emptying the
        // gallery; ERC-20 rows still follow this read.
        missed.push({ includes: isEvmNftAssetId, error: nfts.reason })
    }
    // A genuine failure outranks a service the scope never had.
    const cause =
        missed.find(m => !isPeraServiceUnavailableError(m.error)) ?? missed[0]
    return cause
        ? {
              includes: assetId => missed.some(m => m.includes(assetId)),
              error: cause.error,
          }
        : undefined
}

// Without the token list the stored rows are the only record of which tokens an
// account holds, and they name the contracts the RPC can read. A failed read
// leaves them to `unrefreshedOf`, which keeps them as they are.
const storedTokenIdsOf = async (
    scope: ChainScope,
    reads: readonly PendingRead[],
    nativeAssetId: string,
): Promise<string[]> => {
    try {
        const held = await getAccountHeldAssets({
            sources: reads.map(({ address }) => ({ address, scope })),
        })
        return held
            .map(row => row.assetId)
            .filter(id => id !== nativeAssetId && !isEvmNftAssetId(id))
    } catch (error) {
        logger.warn('Stored token ids could not be read; keeping the rows', {
            scope,
            error,
        })
        return []
    }
}

const toSnapshot = (
    nativeAssetId: string,
    { wei, tokens }: HolderBalances,
    latest: number,
    pending: number,
    blockNumber: bigint,
    nfts: NftRead,
    unrefreshedHoldings: Optional<UnrefreshedHoldings>,
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
        ...(unrefreshedHoldings && { unrefreshedHoldings }),
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
    backfillAccounts: Set<string>,
    scope: ChainScope,
    reads: PendingRead[],
): Promise<void> => {
    const client = createEvmClient(scope, ctx, chain)
    const services = ctx.getPeraBackend(scope).services
    const hasWhitelist = services.has(ASSETS_SERVICE)
    // Reads without the token list skip what only it lists while the change
    // cursor moves on, so each account is backfilled once the list is back.
    if (!hasWhitelist) {
        reads.forEach(read =>
            backfillAccounts.add(backfillKey(scope, read.address)),
        )
    }
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
        hasWhitelist
            ? listedTokenIds(scope)
            : storedTokenIdsOf(scope, reads, chain.nativeAsset.assetId),
    ])
    // Added tokens off the list need their balances read too; the syncer
    // shows them at zero. Checksummed, so a listed token that was also added
    // is read once; a stored id that isn't an address is skipped, not thrown.
    const readTokenIds = [
        ...new Set(
            [...tokenIds, ...reads.flatMap(read => read.addedTokenIds)]
                .filter(id => isAddress(id))
                .map(id => getAddress(id)),
        ),
    ]
    // Issued together, so the batching transport sends the aggregates and
    // every nonce read as one request. Pinning to one block keeps balances,
    // nonces and observedRound from straddling a block boundary.
    const [balances, nonces, nfts] = await Promise.all([
        readBalances(
            client,
            reads.map(read => read.address),
            readTokenIds,
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
        // Cleared by this account's own read with the list, whatever the
        // other accounts or batches of the scope do.
        if (hasWhitelist)
            backfillAccounts.delete(backfillKey(scope, read.address))
        const [latest, pending] = nonce.value
        const holder = balances.get(getAddress(read.address))!
        read.resolve(
            toSnapshot(
                chain.nativeAsset.assetId,
                holder,
                latest,
                pending,
                blockNumber,
                nfts[index],
                unrefreshedOf(
                    scope,
                    services,
                    chain.nativeAsset.assetId,
                    // A token whose balance call failed is absent here, so its
                    // stored row is kept rather than deleted as sold.
                    new Set(holder.tokens.keys()),
                    nfts[index],
                ),
            ),
        )
    })
}

const coalescedAccountReads = (
    ctx: ChainContext,
    chain: EvmChain,
    listedTokenIds: ListedTokenIds,
    backfillAccounts: Set<string>,
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
        readBatch(
            ctx,
            chain,
            listedTokenIds,
            backfillAccounts,
            batch.scope,
            batch.reads,
        ).catch((error: unknown) => {
            batch.reads.forEach(read => read.reject(error))
        })
    }
    return (address, scope, hint) =>
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
            batch.reads.push({
                address,
                addedTokenIds: hint.addedTokenIds ?? [],
                resolve,
                reject,
            })
        })
}

const isRefusedCredential = (error: unknown): boolean =>
    isPeraNetworkError(error) && (error.status === 401 || error.status === 403)

// A full account pass on every block would hammer a public RPC on a fast chain;
// the fallback only runs when block following is down, so a slow refresh is the
// cheaper failure.
const HEAD_FOLLOWING_MIN_INTERVAL_MS = 30_000

const readHeadSignal = async (
    ctx: ChainContext,
    chain: EvmChain,
    scope: ChainScope,
    cursor: Nullable<number>,
): Promise<AccountChangeSignal> => {
    const head = Number(
        await createEvmClient(scope, ctx, chain).getBlockNumber(),
    )
    if (cursor === null) return { changed: true, cursor: head }
    const minBlocks = Math.ceil(
        HEAD_FOLLOWING_MIN_INTERVAL_MS / chain.row.blockTimeMs,
    )
    // The cursor stays put until the gap is due, so it keeps growing; a lagging
    // node's head behind the cursor lands here too and never moves it back.
    if (head - cursor < minBlocks) return { changed: false, cursor }
    return { changed: true, cursor: head }
}

const fetchChangeSignal = (
    ctx: ChainContext,
    chain: EvmChain,
    backfillAccounts: ReadonlySet<string>,
): EthereumAccountStateOps['fetchChangeSignal'] => {
    // A refused key or integrity token won't fix itself before a restart, so
    // the scope stops asking and follows the RPC head instead.
    const refusedScopes = new Set<string>()
    return async (addresses, scope, cursor) => {
        const key = `${scope.chainId}/${scope.networkId}`
        // Plain JSON-RPC can't say which addresses a block touched, so the
        // head stands in for them, paced by readHeadSignal.
        if (refusedScopes.has(key)) {
            return readHeadSignal(ctx, chain, scope, cursor)
        }
        const { services } = ctx.getPeraBackend(scope)
        if (!services.has(BLOCK_FOLLOWING_SERVICE)) {
            return readHeadSignal(ctx, chain, scope, cursor)
        }
        // Reads made without the token list left holdings behind; with it
        // back, report a change until one pass has caught them up.
        if (
            services.has(ASSETS_SERVICE) &&
            cursor !== null &&
            addresses.some(address =>
                backfillAccounts.has(backfillKey(scope, address)),
            )
        ) {
            return { changed: true, cursor }
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
        // The backend omits round when it fails open, which is as good as it
        // being down: follow the paced head, which also seeds a never-synced
        // scope.
        return readHeadSignal(ctx, chain, scope, cursor)
    }
}

/**
 * `listedTokens` is the chain's token list, shared with its assets adapter;
 * without one the ops cache their own, aged by `now`. `readWindowMs` is how
 * long a read waits for others on its scope to share its block and balance
 * pass.
 */
export const createEthereumAccountStateOps = (
    ctx: ChainContext,
    chain: EvmChain,
    {
        now = Date.now,
        listedTokens = cachedWhitelist(chain, now),
        readWindowMs = ACCOUNT_READ_WINDOW_MS,
    }: {
        now?: () => number
        listedTokens?: ListedTokens
        readWindowMs?: number
    } = {},
): EthereumAccountStateOps => {
    const tokenIds = listedTokenIds(listedTokens)
    const backfillAccounts = new Set<string>()
    return {
        chainId: chain.row.id,
        fetchAccountState: coalescedAccountReads(
            ctx,
            chain,
            tokenIds,
            backfillAccounts,
            readWindowMs,
        ),
        accountExists: (address, scope) =>
            readNativeFootprint(ctx, chain, address, scope),
        checkActivity: createEvmActivityCheck(ctx, chain, tokenIds),
        fetchChangeSignal: fetchChangeSignal(ctx, chain, backfillAccounts),
    }
}
