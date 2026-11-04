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
    getAddress,
    InvalidAddressError,
    isAddress,
    type Address,
    type PublicClient,
} from 'viem'
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
    isChainRefusedError,
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
import { HISTORY_SERVICE } from '../history/api/endpoints'
import { createEvmActivityCheck, readNativeFootprint } from './activity'
import { readNftHoldings, type NftHoldingsRead } from './nft-holdings'
import {
    createTokenSightings,
    scanReceivedTokens,
    sharedHistoryScanBudget,
    TOKEN_SCAN_INTERVAL_MS,
    type HistoryScanBudget,
    type TokenSightings,
} from './token-detection'

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
    /** End of the account's last finished received-token scan; undefined before one. */
    tokenScanBlock: Optional<number>
    /** The syncer persists this read, so it may start a received-token scan. */
    isPersisted: boolean
    /** The account has no stored chain state yet. */
    isFirstSync: boolean
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
// One entry per account on a scope: the accounts whose read skipped what only
// the token list gives, and the received-token scans' state.
const backfillKey = (scope: ChainScope, address: string): string =>
    `${scope.chainId}/${scope.networkId}/${address.toLowerCase()}`

const unrefreshedOf = (
    scope: ChainScope,
    services: ReadonlySet<string>,
    nativeAssetId: string,
    readTokenIds: ReadonlySet<string>,
    nfts: NftRead,
    storedReadError: Optional<unknown>,
    unreadOffList: ReadonlyMap<string, unknown>,
): Optional<UnrefreshedHoldings> => {
    const missed: UnrefreshedHoldings[] = []
    // A rejected read says nothing about the balance, so the row stays as it is.
    if (unreadOffList.size > 0) {
        missed.push({
            includes: assetId =>
                isAddress(assetId) && unreadOffList.has(getAddress(assetId)),
            error: unreadOffList.values().next().value,
        })
    }
    // Without the stored ids, a token held off the list was not read at all.
    if (storedReadError !== undefined) {
        missed.push({
            includes: assetId =>
                assetId !== nativeAssetId &&
                !isEvmNftAssetId(assetId) &&
                !readTokenIds.has(
                    isAddress(assetId) ? getAddress(assetId) : assetId,
                ),
            error: storedReadError,
        })
    }
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

type StoredTokenIds = { ids: string[]; error: Optional<unknown> }

// The stored rows are the record of tokens held off the list (detected ones)
// and, without the token list, of every token; they name the contracts the RPC
// can read. A failed read leaves them to `unrefreshedOf`, which keeps them as
// they are.
const storedTokenIdsOf = async (
    scope: ChainScope,
    reads: readonly PendingRead[],
    nativeAssetId: string,
): Promise<StoredTokenIds> => {
    try {
        const held = await getAccountHeldAssets({
            sources: reads.map(({ address }) => ({ address, scope })),
        })
        return {
            ids: held
                .map(row => row.assetId)
                .filter(id => id !== nativeAssetId && !isEvmNftAssetId(id)),
            error: undefined,
        }
    } catch (error) {
        logger.warn('Stored token ids could not be read; keeping the rows', {
            scope,
            error,
        })
        return { ids: [], error }
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
    tokenScanBlock: Optional<number>,
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
        chainState: {
            family: 'evm',
            nonce: { latest, pending },
            ...(tokenScanBlock !== undefined && { tokenScanBlock }),
        },
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

type Detection = {
    now: () => number
    /** When each account's received-token scan last started, by `backfillKey`. */
    lastScanAt: Map<string, number>
    /** End of each account's latest finished scan, by `backfillKey`; a read persists it. */
    scannedBlocks: Map<string, number>
    /** Accounts a finished scan found tokens for that no read has taken up yet. */
    unreadFindings: Set<string>
    sightings: TokenSightings
    budget: HistoryScanBudget
}

const isScanDue = (detection: Detection, key: string): boolean => {
    const last = detection.lastScanAt.get(key)
    return (
        last === undefined || detection.now() - last >= TOKEN_SCAN_INTERVAL_MS
    )
}

const latestOf = (
    a: Optional<number>,
    b: Optional<number>,
): Optional<number> =>
    a === undefined || b === undefined ? (a ?? b) : Math.max(a, b)

// Not awaited: a slow history backend must never hold the balance read. What
// the scan finds is recorded as sightings, and `unreadFindings` makes the next
// change signal ask for a read that includes them.
const startScan = (
    chain: EvmChain,
    scope: ChainScope,
    read: PendingRead,
    detection: Detection,
): void => {
    const key = backfillKey(scope, read.address)
    detection.lastScanAt.set(key, detection.now())
    scanReceivedTokens(
        scope,
        chain,
        read.address,
        latestOf(detection.scannedBlocks.get(key), read.tokenScanBlock),
        detection.budget,
    ).then(
        scan => {
            if (scan.scannedBlock !== undefined) {
                detection.scannedBlocks.set(
                    key,
                    latestOf(
                        detection.scannedBlocks.get(key),
                        scan.scannedBlock,
                    )!,
                )
            }
            const known = detection.sightings.of(scope, read.address).length
            detection.sightings.record(scope, read.address, scan.tokenIds)
            // A token a scan finds again at its end block is not news.
            if (detection.sightings.of(scope, read.address).length > known) {
                detection.unreadFindings.add(key)
            }
        },
        (error: unknown) => {
            logger.warn('Received-token scan failed; keeping stored tokens', {
                scope,
                error,
            })
        },
    )
}

type OffListRead = {
    balances: Map<string, Map<string, bigint>>
    /** Tokens whose read rejected, by checksummed id, with why. */
    unread: Map<string, unknown>
}

// Tokens off the list are whatever contract sent the address something, so one
// that burns the call's gas must cost only its own balance: the aggregate is
// retried a token at a time. The node being down fails the listed read beside
// this one, so a token still rejecting alone is that token's, and its stored
// row is kept rather than deleted as sold.
const readOffListBalances = async (
    client: PublicClient,
    holders: string[],
    tokenIds: string[],
    blockNumber: bigint,
): Promise<OffListRead> => {
    const result: OffListRead = { balances: new Map(), unread: new Map() }
    if (tokenIds.length === 0) return result
    const take = (read: Map<string, HolderBalances>): void => {
        for (const [holder, { tokens }] of read) {
            const entry =
                result.balances.get(holder) ?? new Map<string, bigint>()
            tokens.forEach((balance, id) => entry.set(id, balance))
            result.balances.set(holder, entry)
        }
    }
    try {
        take(await readBalances(client, holders, tokenIds, blockNumber))
        return result
    } catch (error) {
        logger.warn(
            'Off-list token balances unreadable together; retrying one by one',
            { error },
        )
    }
    const each = await Promise.allSettled(
        tokenIds.map(id => readBalances(client, holders, [id], blockNumber)),
    )
    each.forEach((outcome, index) => {
        if (outcome.status === 'fulfilled') take(outcome.value)
        else result.unread.set(tokenIds[index]!, outcome.reason)
    })
    return result
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
    detection: Detection,
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
    // Cleared before the sightings are read, so a scan finishing mid-read
    // still asks for another one.
    reads.forEach(read =>
        detection.unreadFindings.delete(backfillKey(scope, read.address)),
    )
    // Started ahead of the node reads, which it needs nothing from: a failing
    // RPC then costs one forced retry per interval, not one per tick. Only the
    // syncer's reads discover tokens; a preview of an address the wallet
    // doesn't hold would spend the history budget for nothing.
    if (services.has(HISTORY_SERVICE)) {
        reads.forEach(read => {
            const key = backfillKey(scope, read.address)
            // No stored state: a first sync, or an account imported again after
            // its rows were removed, so the old scan's end no longer covers it.
            // The throttle stays: a node that keeps failing leaves the account
            // with no stored state, and must not restart the scan every tick.
            if (read.isPersisted && read.isFirstSync) {
                detection.scannedBlocks.delete(key)
            }
            if (read.isPersisted && isScanDue(detection, key)) {
                startScan(chain, scope, read, detection)
            }
        })
    }
    const [blockNumber, listedIds, stored] = await Promise.all([
        client.getBlockNumber(),
        hasWhitelist ? listedTokenIds(scope) : Promise.resolve<string[]>([]),
        storedTokenIdsOf(scope, reads, chain.nativeAsset.assetId),
    ])
    // Checksummed, so a token named twice is read once; an id that isn't an
    // address is skipped, not thrown.
    const checksummed = (ids: readonly string[]): string[] => [
        ...new Set(ids.filter(id => isAddress(id)).map(id => getAddress(id))),
    ]
    const listed = checksummed(listedIds)
    const listedSet = new Set(listed)
    // Added, stored and detected tokens: the syncer shows an added one at
    // zero, and stored ids keep a detected token read until its balance is gone.
    const offList = checksummed([
        ...stored.ids,
        ...reads.flatMap(read => [
            ...read.addedTokenIds,
            ...detection.sightings.of(scope, read.address),
        ]),
    ]).filter(id => !listedSet.has(id))
    // Taken with the sightings, so a scan finishing mid-read can't persist an
    // end past tokens this read didn't include.
    const scanEnds = reads.map(read =>
        latestOf(
            detection.scannedBlocks.get(backfillKey(scope, read.address)),
            read.tokenScanBlock,
        ),
    )
    const holders = reads.map(read => read.address)
    // Only a token the account has a row for, or the user added, is worth
    // keeping through a failed read; a sighted one that keeps failing (a
    // broken contract, a spam airdrop) must not hold the account's refresh in
    // a failed state every tick.
    const keptIds = new Set(
        checksummed([
            ...stored.ids,
            ...reads.flatMap(read => read.addedTokenIds),
        ]),
    )
    // Issued together, so the batching transport sends the aggregates and
    // every nonce read as one request. Pinning to one block keeps balances,
    // nonces and observedRound from straddling a block boundary.
    const [balances, offListRead, nonces, nfts] = await Promise.all([
        readBalances(client, holders, listed, blockNumber),
        readOffListBalances(client, holders, offList, blockNumber),
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
    const unreadKept = new Map<string, unknown>()
    offListRead.unread.forEach((error, id) => {
        if (keptIds.has(id)) unreadKept.set(id, error)
        else logger.debug('Sighted token unreadable; leaving it out', { id })
    })
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
        offListRead.balances
            .get(getAddress(read.address))
            ?.forEach((balance, id) => holder.tokens.set(id, balance))
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
                    stored.error,
                    unreadKept,
                ),
                scanEnds[index],
            ),
        )
    })
}

const coalescedAccountReads = (
    ctx: ChainContext,
    chain: EvmChain,
    listedTokenIds: ListedTokenIds,
    backfillAccounts: Set<string>,
    detection: Detection,
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
            detection,
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
                isPersisted: hint.isPersisted === true,
                isFirstSync: hint.priorChainState === undefined,
                tokenScanBlock:
                    hint.priorChainState?.family === 'evm'
                        ? hint.priorChainState.tokenScanBlock
                        : undefined,
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
    detection: Detection,
): EthereumAccountStateOps['fetchChangeSignal'] => {
    // A refused key or integrity token won't fix itself before a restart, so
    // the scope stops asking and follows the RPC head instead.
    const refusedScopes = new Set<string>()
    return async (addresses, scope, cursor) => {
        const key = `${scope.chainId}/${scope.networkId}`
        // Tokens arrive without touching the address's own activity, so a scan
        // that is due, or one that found tokens no read has taken up, is a
        // change whatever the block follower says.
        if (
            cursor !== null &&
            ctx.getPeraBackend(scope).services.has(HISTORY_SERVICE) &&
            addresses.some(address => {
                const accountKey = backfillKey(scope, address)
                return (
                    detection.unreadFindings.has(accountKey) ||
                    isScanDue(detection, accountKey)
                )
            })
        ) {
            return { changed: true, cursor }
        }
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
            // A refused chain is already gated in config, so later ticks skip
            // the request; this tick still has to read the head to keep RPC going.
            if (isChainRefusedError(error)) {
                return readHeadSignal(ctx, chain, scope, cursor)
            }
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
        tokenSightings = createTokenSightings(),
        scanBudget = sharedHistoryScanBudget(),
    }: {
        now?: () => number
        listedTokens?: ListedTokens
        readWindowMs?: number
        tokenSightings?: TokenSightings
        scanBudget?: HistoryScanBudget
    } = {},
): EthereumAccountStateOps => {
    const tokenIds = listedTokenIds(listedTokens)
    const backfillAccounts = new Set<string>()
    const detection: Detection = {
        now,
        lastScanAt: new Map(),
        scannedBlocks: new Map(),
        unreadFindings: new Set(),
        sightings: tokenSightings,
        budget: scanBudget,
    }
    return {
        chainId: chain.row.id,
        fetchAccountState: coalescedAccountReads(
            ctx,
            chain,
            tokenIds,
            backfillAccounts,
            detection,
            readWindowMs,
        ),
        accountExists: (address, scope) =>
            readNativeFootprint(ctx, chain, address, scope),
        checkActivity: createEvmActivityCheck(ctx, chain, tokenIds),
        fetchChangeSignal: fetchChangeSignal(
            ctx,
            chain,
            backfillAccounts,
            detection,
        ),
    }
}
