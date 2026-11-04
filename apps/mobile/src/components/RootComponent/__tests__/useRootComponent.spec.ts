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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { AppState } from 'react-native'
import { useRootComponent } from '../useRootComponent'

const mocks = vi.hoisted(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    markAllScopesStale: vi.fn(),
    accounts: [] as unknown[],
}))

vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: () => ({
        start: mocks.start,
        stop: mocks.stop,
        markAllScopesStale: mocks.markAllScopesStale,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAllAccounts: () => mocks.accounts,
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return { ...actual, config: { ...actual.config, pollingEnabled: true } }
})

// Drives the app through `states` from active, as the AppState listener sees it.
const moveThrough = (states: string[]) => {
    const listener = vi.mocked(AppState.addEventListener).mock.calls.at(-1)![1]
    act(() => {
        states.forEach(state => listener(state as never))
    })
}

describe('useRootComponent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.accounts = []
    })

    it('holds the background poll while the migration is still running', () => {
        renderHook(() => useRootComponent({ migrationInProgress: true }))

        expect(mocks.stop).toHaveBeenCalled()
        expect(mocks.start).not.toHaveBeenCalled()
    })

    it('re-reads every network on a return from the background', () => {
        mocks.accounts = [{ id: 'a' }]
        renderHook(() => useRootComponent({ migrationInProgress: false }))
        mocks.start.mockClear()

        moveThrough(['background', 'active'])

        expect(mocks.markAllScopesStale).toHaveBeenCalledTimes(1)
        expect(mocks.start).toHaveBeenCalledTimes(1)
    })

    it('re-reads every network when iOS returns from the background through inactive', () => {
        mocks.accounts = [{ id: 'a' }]
        renderHook(() => useRootComponent({ migrationInProgress: false }))

        moveThrough(['inactive', 'background', 'inactive', 'active'])

        expect(mocks.markAllScopesStale).toHaveBeenCalledTimes(1)
    })

    it('resumes without re-reading after an inactive blip, as a Face ID prompt causes on iOS', () => {
        mocks.accounts = [{ id: 'a' }]
        renderHook(() => useRootComponent({ migrationInProgress: false }))
        mocks.start.mockClear()

        moveThrough(['inactive', 'active'])

        expect(mocks.start).toHaveBeenCalledTimes(1)
        expect(mocks.markAllScopesStale).not.toHaveBeenCalled()
    })
})
