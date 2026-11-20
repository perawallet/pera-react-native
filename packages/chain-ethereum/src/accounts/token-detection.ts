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
    erc1155Abi,
    erc20Abi,
    erc721Abi,
    getAddress,
    isAddress,
    isAddressEqual,
    parseEventLogs,
    type Log,
} from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    isRequestBudgetSpentError,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { EvmChain } from '../chains/types'
import { fetchHistoryPage } from '../history/api/endpoints'
import {
    sharedHistoryPageBudget,
    type HistoryPageBudget,
} from '../history/api/page-budget'

/** A scan per account at most this often; the backend caches history's first page for as long. */
export const TOKEN_SCAN_INTERVAL_MS = 5 * 60_000

/** Pages one scan reads: a first scan of a very active account stops here, older tokens are added by contract. */
export const TOKEN_SCAN_MAX_PAGES = 5

const HISTORY_SCAN_BUDGET = 30
const HISTORY_SCAN_WINDOW_MS = 10 * 60_000

const sightingKey = (scope: ChainScope, address: string): string =>
    `${scope.chainId}/${scope.networkId}/${address.toLowerCase()}`

/**
 * Tokens seen arriving at an address, for the session; the next account read
 * includes them. A mined NFT send also marks its sender's NFT list stale: a
 * transfer past page one leaves page one as it was, so the next read lists
 * every page.
 */
export type TokenSightings = {
    record(
        scope: ChainScope,
        address: string,
        tokenIds: readonly string[],
    ): void
    of(scope: ChainScope, address: string): readonly string[]
    recordSend(scope: ChainScope, address: string): void
    hasSend(scope: ChainScope, address: string): boolean
    /** True once per recorded send. */
    takeSend(scope: ChainScope, address: string): boolean
}

export const createTokenSightings = (): TokenSightings => {
    const seen = new Map<string, Set<string>>()
    const sends = new Set<string>()
    return {
        record: (scope, address, tokenIds) => {
            if (tokenIds.length === 0) return
            const key = sightingKey(scope, address)
            const entry = seen.get(key) ?? new Set<string>()
            tokenIds.forEach(id => entry.add(getAddress(id)))
            seen.set(key, entry)
        },
        of: (scope, address) => [
            ...(seen.get(sightingKey(scope, address)) ?? []),
        ],
        recordSend: (scope, address) => {
            sends.add(sightingKey(scope, address))
        },
        hasSend: (scope, address) => sends.has(sightingKey(scope, address)),
        takeSend: (scope, address) => sends.delete(sightingKey(scope, address)),
    }
}

/**
 * Contracts that emitted an ERC-20 `Transfer` of a non-zero value to
 * `address`, checksummed and deduplicated. An ERC-721 `Transfer` has a fourth
 * topic, so strict decoding skips it.
 */
export const receivedTokenIdsOf = (
    logs: readonly Log[],
    address: string,
): string[] => {
    if (!isAddress(address)) return []
    const parsed = parseEventLogs({
        abi: erc20Abi,
        eventName: 'Transfer',
        logs: [...logs],
    })
    return [
        ...new Set(
            parsed
                .filter(
                    log =>
                        log.args.value > 0n &&
                        isAddressEqual(log.args.to, address),
                )
                .map(log => getAddress(log.address)),
        ),
    ]
}

/**
 * Whether the logs move an ERC-721 or ERC-1155 token out of `address`. An
 * ERC-20 `Transfer` has no fourth topic, so strict ERC-721 decoding skips it.
 */
export const sendsNftFrom = (
    logs: readonly Log[],
    address: string,
): boolean => {
    if (!isAddress(address)) return false
    return [
        ...parseEventLogs({
            abi: erc721Abi,
            eventName: 'Transfer',
            logs: [...logs],
        }),
        ...parseEventLogs({
            abi: erc1155Abi,
            eventName: ['TransferSingle', 'TransferBatch'],
            logs: [...logs],
        }),
    ].some(log => isAddressEqual(log.args.from, address))
}

/**
 * Spends one unit per history page; refuses once the window's units are gone.
 * A scan's first page names its account: one refused then waits in line, and
 * the units left are held for those ahead of it, so accounts asking in the
 * same order every tick can't take every renewed window from the ones behind.
 */
export type HistoryScanBudget = { take(key?: string): boolean }

export const createHistoryScanBudget = (
    limit: number,
    windowMs: number,
    now: () => number,
): HistoryScanBudget => {
    let windowStart = now()
    let used = 0
    // When each waiting account was first refused, and last asked.
    const waiting = new Map<string, { since: number; seen: number }>()
    return {
        take: key => {
            const at = now()
            if (at - windowStart >= windowMs) {
                windowStart = at
                used = 0
            }
            // An account still due asks again each interval; one that stopped
            // asking (removed, its chain turned off) gives up its place.
            waiting.forEach(({ seen }, waiter) => {
                if (at - seen >= 2 * TOKEN_SCAN_INTERVAL_MS) {
                    waiting.delete(waiter)
                }
            })
            const own = key === undefined ? undefined : waiting.get(key)
            let ahead = 0
            waiting.forEach(({ since }, waiter) => {
                if (
                    waiter !== key &&
                    (own === undefined || since < own.since)
                ) {
                    ahead++
                }
            })
            if (limit - used > ahead) {
                used++
                if (key !== undefined) waiting.delete(key)
                return true
            }
            if (key !== undefined) {
                waiting.set(key, { since: own?.since ?? at, seen: at })
            }
            return false
        },
    }
}

/**
 * `scans` only while `pages` has room, so a scan never spends its own unit on
 * a page the shared history budget would refuse.
 */
export const withinHistoryPageBudget = (
    scans: HistoryScanBudget,
    pages: HistoryPageBudget,
): HistoryScanBudget => ({
    take: key => pages.hasRoom() && scans.take(key),
})

let sharedBudget: Optional<HistoryScanBudget>

// Token scans' share of the history page budget every caller spends from:
// the rest is left to reads someone is waiting on. Built on first use, so
// importing runs nothing.
// ponytail: past ~15 account-networks scans space out, so detection lags.
export const sharedHistoryScanBudget = (): HistoryScanBudget => {
    sharedBudget ??= withinHistoryPageBudget(
        createHistoryScanBudget(
            HISTORY_SCAN_BUDGET,
            HISTORY_SCAN_WINDOW_MS,
            Date.now,
        ),
        sharedHistoryPageBudget(),
    )
    return sharedBudget
}

/** A scan cut short above the previous end: every row from `ceiling` down to `cursor` is read. */
export type ScanResume = { cursor: string; ceiling: number }

export type TokenScan = {
    tokenIds: string[]
    /** Every row down to the previous end is read and this is the new end; undefined while rows above it are unread. */
    scannedBlock: Optional<number>
    /** Where the next scan carries on reading, before it reads the head again. */
    resume: Optional<ScanResume>
}

/**
 * Tokens `address` received, read from its history newest first (or from
 * `resume`) down to `sinceBlock`, the end of the previous scan, or to the page
 * cap. Rejects on a failed page; a page the shared budget refuses cuts the
 * scan short instead.
 */
export const scanReceivedTokens = async (
    scope: ChainScope,
    chain: EvmChain,
    address: string,
    sinceBlock: Optional<number>,
    budget: HistoryScanBudget,
    resume?: ScanResume,
): Promise<TokenScan> => {
    const found = new Set<string>()
    let newest = resume?.ceiling
    let cursor = resume?.cursor
    // A first scan has no end to reach: what it reads within the cap is the
    // backfill, and the account's end starts at its newest row.
    const cutShort = (isCapped: boolean): TokenScan => ({
        tokenIds: [...found],
        scannedBlock: sinceBlock === undefined && isCapped ? newest : undefined,
        resume:
            sinceBlock !== undefined &&
            cursor !== undefined &&
            newest !== undefined
                ? { cursor, ceiling: newest }
                : undefined,
    })
    for (let page = 0; page < TOKEN_SCAN_MAX_PAGES; page++) {
        const isTaken = budget.take(
            page === 0 ? sightingKey(scope, address) : undefined,
        )
        if (!isTaken) return cutShort(false)
        // The page waits behind every History read, so the shared budget can
        // run out between `take` and the send.
        const read = await fetchHistoryPage(
            scope,
            chain,
            address,
            cursor === undefined ? undefined : { cursor },
            { isBackground: true },
        ).catch((error: unknown) => {
            if (isRequestBudgetSpentError(error)) return undefined
            throw error
        })
        if (read === undefined) return cutShort(false)
        const { items, next } = read
        let isReachedMarker = false
        for (const item of items) {
            const block = item.block_number
            if (block !== undefined) {
                newest = Math.max(newest ?? block, block)
                if (sinceBlock !== undefined && block < sinceBlock) {
                    isReachedMarker = true
                    continue
                }
            }
            for (const transfer of item.token_transfers) {
                if (
                    transfer.value !== '0' &&
                    transfer.to.toLowerCase() === address.toLowerCase()
                ) {
                    found.add(getAddress(transfer.contract))
                }
            }
        }
        if (isReachedMarker || next === null) {
            return {
                tokenIds: [...found],
                scannedBlock: newest,
                resume: undefined,
            }
        }
        cursor = next
    }
    return cutShort(true)
}
