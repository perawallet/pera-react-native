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

import { afterEach, describe, expect, it } from 'vitest'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { isRequestBudgetSpentError } from '@perawallet/wallet-core-shared'

import {
    createFirstPageCache,
    createHistoryPageBudget,
    DEFAULT_HISTORY_PAGE_BUDGET,
    historyBudgetSpentError,
    readHistoryPageBudget,
} from '../page-budget'

describe('createHistoryPageBudget', () => {
    it('refuses past the limit until the epoch-aligned window renews', () => {
        let now = 1_250
        const budget = createHistoryPageBudget(
            () => 2,
            1_000,
            () => now,
        )

        const taken = [budget.take(), budget.take(), budget.take()]
        const hasRoomWhenSpent = budget.hasRoom()
        now = 2_000
        const takenAfterRenewal = budget.take()

        expect(taken).toEqual([true, true, false])
        expect(hasRoomWhenSpent).toBe(false)
        expect(takenAfterRenewal).toBe(true)
    })

    it('spends nothing when only asked for room', () => {
        const budget = createHistoryPageBudget(
            () => 1,
            1_000,
            () => 0,
        )

        budget.hasRoom()
        budget.hasRoom()

        expect(budget.take()).toBe(true)
    })

    it('applies a changed limit inside the window', () => {
        let limit = 1
        const budget = createHistoryPageBudget(
            () => limit,
            1_000,
            () => 0,
        )
        budget.take()

        limit = 2

        expect(budget.take()).toBe(true)
    })

    it('reports the time left until the window renews', () => {
        const budget = createHistoryPageBudget(
            () => 1,
            1_000,
            () => 2_300,
        )

        expect(budget.msUntilRenewal()).toBe(700)
    })
})

describe('createFirstPageCache', () => {
    it('counts a page one as cached from when it was sent until the cache time passes', () => {
        let now = 0
        const cache = createFirstPageCache(1_000, () => now)

        const record = cache.sent('1/0xaa/')
        now = 400
        record()
        now = 999
        const isCachedJustBefore = cache.isCached('1/0xaa/')
        now = 1_000
        const isCachedAtExpiry = cache.isCached('1/0xaa/')

        expect(isCachedJustBefore).toBe(true)
        expect(isCachedAtExpiry).toBe(false)
    })

    it('counts nothing as cached until the read is recorded', () => {
        const cache = createFirstPageCache(1_000, () => 0)

        cache.sent('1/0xaa/')

        expect(cache.isCached('1/0xaa/')).toBe(false)
    })
})

describe('readHistoryPageBudget', () => {
    afterEach(() => {
        useRemoteConfigStore.setState({ configOverrides: {} })
    })

    it('reads the configured value', () => {
        useRemoteConfigStore.setState({
            configOverrides: { evm_history_page_budget: 40 },
        })

        expect(readHistoryPageBudget()).toBe(40)
    })

    it('falls back to the bundled budget when none is configured', () => {
        expect(readHistoryPageBudget()).toBe(DEFAULT_HISTORY_PAGE_BUDGET)
    })
})

describe('historyBudgetSpentError', () => {
    it('is a budget refusal that waits for the window to renew', () => {
        const error = historyBudgetSpentError(
            createHistoryPageBudget(
                () => 1,
                1_000,
                () => 2_300,
            ),
        )

        expect(isRequestBudgetSpentError(error)).toBe(true)
        expect(error.retryAfterMs).toBe(700)
    })
})
