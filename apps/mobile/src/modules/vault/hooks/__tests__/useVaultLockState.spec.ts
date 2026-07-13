/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    isVaultInitialized: vi.fn(),
    isUnlocked: vi.fn(),
    listeners: [] as Array<(unlocked: boolean) => void>,
}))

vi.mock('@perawallet/wallet-extension-keystore-chrome', () => ({
    isVaultInitialized: mocks.isVaultInitialized,
    isUnlocked: mocks.isUnlocked,
    onLockStateChanged: (listener: (unlocked: boolean) => void) => {
        mocks.listeners.push(listener)
        return () => {
            mocks.listeners.length = 0
        }
    },
}))

import { useVaultLockState } from '../useVaultLockState'

describe('useVaultLockState', () => {
    beforeEach(() => {
        mocks.listeners.length = 0
        mocks.isVaultInitialized.mockResolvedValue(true)
        mocks.isUnlocked.mockResolvedValue(false)
    })

    it('starts null then resolves initial state', async () => {
        const { result } = renderHook(() => useVaultLockState())
        expect(result.current.isUnlocked).toBeNull()
        await waitFor(() => expect(result.current.isUnlocked).toBe(false))
        expect(result.current.isInitialized).toBe(true)
    })

    it('updates when the lock state changes in another context', async () => {
        const { result } = renderHook(() => useVaultLockState())
        await waitFor(() => expect(result.current.isUnlocked).toBe(false))
        act(() => {
            for (const listener of mocks.listeners) listener(true)
        })
        expect(result.current.isUnlocked).toBe(true)
    })

    it('keeps a lock event that lands while the initial refresh is still pending', async () => {
        // Hold the initial refresh() read open so we can fire a lock event
        // before it resolves, then let it resolve with a stale "unlocked"
        // value afterwards. The event's locked state must win.
        let resolveUnlocked: (value: boolean) => void = () => {}
        mocks.isUnlocked.mockReturnValue(
            new Promise<boolean>(resolve => {
                resolveUnlocked = resolve
            }),
        )

        const { result } = renderHook(() => useVaultLockState())
        await waitFor(() => expect(mocks.listeners.length).toBe(1))

        act(() => {
            for (const listener of mocks.listeners) listener(false)
        })
        expect(result.current.isUnlocked).toBe(false)

        // Stale refresh resolves with a value that would re-unlock the vault
        // if it were allowed to overwrite the event's state.
        await act(async () => {
            resolveUnlocked(true)
            await Promise.resolve()
        })

        expect(result.current.isUnlocked).toBe(false)
    })

    it('unsubscribes on unmount', async () => {
        const { result, unmount } = renderHook(() => useVaultLockState())
        await waitFor(() => expect(result.current.isUnlocked).not.toBeNull())
        expect(mocks.listeners.length).toBe(1)
        unmount()
        expect(mocks.listeners.length).toBe(0)
    })
})
