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
    erc20Abi,
    getAddress,
    isAddress,
    isAddressEqual,
    parseEventLogs,
    type Log,
} from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { EvmChain } from '../chains/types'
import { fetchHistoryPage } from '../history/api/endpoints'

/** A scan per account at most this often; the backend caches history's first page for as long. */
export const TOKEN_SCAN_INTERVAL_MS = 5 * 60_000

/** Pages one scan reads: a first scan of a very active account stops here, older tokens are added by contract. */
export const TOKEN_SCAN_MAX_PAGES = 5

const HISTORY_SCAN_BUDGET = 30
const HISTORY_SCAN_WINDOW_MS = 10 * 60_000

const sightingKey = (scope: ChainScope, address: string): string =>
    `${scope.chainId}/${scope.networkId}/${address.toLowerCase()}`

/** Tokens seen arriving at an address, for the session; the next account read includes them. */
export type TokenSightings = {
    record(
        scope: ChainScope,
        address: string,
        tokenIds: readonly string[],
    ): void
    of(scope: ChainScope, address: string): readonly string[]
}

export const createTokenSightings = (): TokenSightings => {
    const seen = new Map<string, Set<string>>()
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

/** Spends one unit per history page; refuses once the window's units are gone. */
export type HistoryScanBudget = { take(): boolean }

export const createHistoryScanBudget = (
    limit: number,
    windowMs: number,
    now: () => number,
): HistoryScanBudget => {
    let windowStart = now()
    let used = 0
    return {
        take: () => {
            const at = now()
            if (at - windowStart >= windowMs) {
                windowStart = at
                used = 0
            }
            if (used >= limit) return false
            used++
            return true
        },
    }
}

let sharedBudget: Optional<HistoryScanBudget>

// One budget for every EVM chain: the backend limits history requests per
// device, not per chain. Built on first use, so importing runs nothing.
// ponytail: past ~15 account-networks scans space out, so detection lags.
export const sharedHistoryScanBudget = (): HistoryScanBudget => {
    sharedBudget ??= createHistoryScanBudget(
        HISTORY_SCAN_BUDGET,
        HISTORY_SCAN_WINDOW_MS,
        Date.now,
    )
    return sharedBudget
}

export type TokenScan = {
    tokenIds: string[]
    /** Undefined when nothing was read or the budget ran out first, so the next scan reads that range again. */
    scannedBlock: Optional<number>
}

/**
 * Tokens `address` received, read from its history newest first down to
 * `sinceBlock`, the end of the previous scan, or to the page cap. Rejects on a
 * failed page.
 */
export const scanReceivedTokens = async (
    scope: ChainScope,
    chain: EvmChain,
    address: string,
    sinceBlock: Optional<number>,
    budget: HistoryScanBudget,
): Promise<TokenScan> => {
    const found = new Set<string>()
    let newest: Optional<number>
    let cursor: Optional<string>
    for (let page = 0; page < TOKEN_SCAN_MAX_PAGES; page++) {
        if (!budget.take()) {
            return { tokenIds: [...found], scannedBlock: undefined }
        }
        const { items, next } = await fetchHistoryPage(
            scope,
            chain,
            address,
            cursor === undefined ? undefined : { cursor },
        )
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
        if (isReachedMarker || next === null) break
        cursor = next
    }
    return { tokenIds: [...found], scannedBlock: newest }
}
