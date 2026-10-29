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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onlineManager } from '@tanstack/react-query'
import { refreshPhishingLists, PHISHING_LIST_REFRESH_AGE_MS } from '../refresh'
import {
    PHISHING_LIST_CHECK_INTERVAL_MS,
    startPhishingListRefresh,
} from '../scheduler'
import { ensurePhishingListsSeeded } from '../seed'
import { PHISHING_LIST_SOURCES } from '../sources'
import { usePhishingListStore } from '../store/store'

vi.mock('../refresh', async importOriginal => ({
    ...(await importOriginal<object>()),
    refreshPhishingLists: vi.fn(async () => ({})),
}))
vi.mock('../seed', () => ({ ensurePhishingListsSeeded: vi.fn(async () => {}) }))

const NOW = 1_800_000_000_000

const markAllRefreshedAt = (at: number): void => {
    for (const { id: source } of PHISHING_LIST_SOURCES) {
        usePhishingListStore.getState().activateGeneration(source, {
            generation: 1,
            refreshedAt: at,
            origin: 'downloaded',
        })
    }
}

describe('startPhishingListRefresh', () => {
    let stop: () => void

    beforeEach(() => {
        vi.useFakeTimers({ now: NOW })
        vi.clearAllMocks()
        onlineManager.setOnline(true)
        usePhishingListStore.getState().resetState()
    })

    afterEach(() => {
        stop?.()
        vi.useRealTimers()
        onlineManager.setOnline(true)
    })

    it('seeds, then refreshes a never-downloaded copy at once', async () => {
        markAllRefreshedAt(0)

        stop = startPhishingListRefresh()
        await vi.advanceTimersByTimeAsync(0)

        expect(ensurePhishingListsSeeded).toHaveBeenCalled()
        expect(refreshPhishingLists).toHaveBeenCalledTimes(1)
    })

    it('waits until a copy is due, checking hourly', async () => {
        markAllRefreshedAt(NOW)

        stop = startPhishingListRefresh()
        await vi.advanceTimersByTimeAsync(0)
        expect(refreshPhishingLists).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(
            PHISHING_LIST_REFRESH_AGE_MS - PHISHING_LIST_CHECK_INTERVAL_MS,
        )
        expect(refreshPhishingLists).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(PHISHING_LIST_CHECK_INTERVAL_MS)
        expect(refreshPhishingLists).toHaveBeenCalledTimes(1)
    })

    it('skips the download offline and catches up on reconnect', async () => {
        markAllRefreshedAt(0)
        onlineManager.setOnline(false)

        stop = startPhishingListRefresh()
        await vi.advanceTimersByTimeAsync(0)
        expect(ensurePhishingListsSeeded).toHaveBeenCalled()
        expect(refreshPhishingLists).not.toHaveBeenCalled()

        onlineManager.setOnline(true)
        await vi.advanceTimersByTimeAsync(0)
        expect(refreshPhishingLists).toHaveBeenCalledTimes(1)
    })

    it('stops checking once stopped', async () => {
        markAllRefreshedAt(NOW)
        stop = startPhishingListRefresh()
        await vi.advanceTimersByTimeAsync(0)
        stop()

        await vi.advanceTimersByTimeAsync(PHISHING_LIST_REFRESH_AGE_MS * 2)
        onlineManager.setOnline(false)
        onlineManager.setOnline(true)
        await vi.advanceTimersByTimeAsync(0)

        expect(refreshPhishingLists).not.toHaveBeenCalled()
    })
})
