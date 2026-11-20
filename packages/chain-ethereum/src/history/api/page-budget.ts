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
    readPositiveIntegerConfig,
    RemoteConfigKeys,
} from '@perawallet/wallet-core-remote-config'
import {
    RequestBudgetSpentError,
    type Optional,
} from '@perawallet/wallet-core-shared'

/** Bundled fallback for the `evm_history_page_budget` remote value. */
export const DEFAULT_HISTORY_PAGE_BUDGET = 55
// The backend's window is fixed and aligned to the epoch. The count lives in
// memory, so a relaunch inside a window starts over.
export const HISTORY_PAGE_WINDOW_MS = 10 * 60_000

/** History pages every caller may send per window, all chains together. */
export const readHistoryPageBudget = (): number =>
    readPositiveIntegerConfig(
        RemoteConfigKeys.evm_history_page_budget,
        DEFAULT_HISTORY_PAGE_BUDGET,
    )

/** One unit per history page the backend counts, from every caller. */
export type HistoryPageBudget = {
    hasRoom(): boolean
    take(): boolean
    /** Milliseconds until the window renews. */
    msUntilRenewal(): number
}

/** `limit` is read on every call, so a remote change applies mid-window. */
export const createHistoryPageBudget = (
    limit: () => number,
    windowMs: number,
    now: () => number,
): HistoryPageBudget => {
    let window = Math.floor(now() / windowMs)
    let used = 0
    const roll = (): void => {
        const current = Math.floor(now() / windowMs)
        if (current !== window) {
            window = current
            used = 0
        }
    }
    return {
        hasRoom: () => {
            roll()
            return used < limit()
        },
        take: () => {
            roll()
            if (used >= limit()) return false
            used++
            return true
        },
        msUntilRenewal: () => (window + 1) * windowMs - now(),
    }
}

let sharedBudget: Optional<HistoryPageBudget>

// Built on first use, so importing runs nothing.
export const sharedHistoryPageBudget = (): HistoryPageBudget => {
    sharedBudget ??= createHistoryPageBudget(
        readHistoryPageBudget,
        HISTORY_PAGE_WINDOW_MS,
        Date.now,
    )
    return sharedBudget
}

// Counterparty checks' share (Send's recipient safety and History's poisoning
// flags), so the reads a screen lists keep the rest.
export const SUPPLEMENTARY_HISTORY_PAGE_SHARE = 15

let sharedSupplementary: Optional<HistoryPageBudget>

export const sharedSupplementaryPageShare = (): HistoryPageBudget => {
    sharedSupplementary ??= createHistoryPageBudget(
        () => SUPPLEMENTARY_HISTORY_PAGE_SHARE,
        HISTORY_PAGE_WINDOW_MS,
        Date.now,
    )
    return sharedSupplementary
}

// The backend serves page one from a cache for up to this long per chain,
// address, limit and asset filter, and counts only a miss against the device.
export const FIRST_PAGE_CACHE_MS = 5 * 60_000

/** Page-one reads the backend will answer from its cache, so they cost no unit. */
export type FirstPageCache = {
    isCached(key: string): boolean
    /** Call as the read is sent; the returned function records it once it succeeds. */
    sent(key: string): () => void
}

export const createFirstPageCache = (
    ttlMs: number,
    now: () => number,
): FirstPageCache => {
    const sentAt = new Map<string, number>()
    return {
        isCached: key => {
            const at = sentAt.get(key)
            return at !== undefined && now() - at < ttlMs
        },
        // Stamped at send, before the backend writes its entry, so ours
        // never outlives it.
        sent: key => {
            const at = now()
            return () => {
                sentAt.forEach((stamp, stale) => {
                    if (now() - stamp >= ttlMs) sentAt.delete(stale)
                })
                sentAt.set(key, at)
            }
        },
    }
}

let sharedFirstPages: Optional<FirstPageCache>

export const sharedFirstPageCache = (): FirstPageCache => {
    sharedFirstPages ??= createFirstPageCache(FIRST_PAGE_CACHE_MS, Date.now)
    return sharedFirstPages
}

export const historyBudgetSpentError = (
    budget: HistoryPageBudget,
): RequestBudgetSpentError =>
    new RequestBudgetSpentError('evm-history', budget.msUntilRenewal())
