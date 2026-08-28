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

import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hand-driven react-navigation focus. The screen sits in a native stack that
// keeps it mounted across forward/back nav, so the bug only shows on refocus —
// the integration navigator can't reproduce it (it remounts).
const nav = vi.hoisted(() => {
    const listeners = new Map<string, () => void>()
    const navigate = vi.fn()
    return {
        navigate,
        addListener: (event: string, cb: () => void) => {
            listeners.set(event, cb)
            return () => listeners.delete(event)
        },
        fireFocus: () => listeners.get('focus')?.(),
        reset: () => {
            listeners.clear()
            navigate.mockClear()
        },
    }
})

// Stable across renders like production's useCallback([]) — fresh functions
// would re-fire the dependent effects into an infinite loop. Fresh buffer per
// call, since the screen keeps a zeroable copy.
const executeWithMnemonic = vi.hoisted(() =>
    vi.fn((handler: (src: Uint16Array) => void) => {
        handler(Uint16Array.from([10, 20, 30]))
        return Promise.resolve()
    }),
)
const checkPinEnabled = vi.hoisted(() => vi.fn(() => Promise.resolve(false)))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => nav,
    useRoute: () => ({ params: { address: 'ADDR' } }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: (selector: (state: unknown) => unknown) =>
        selector({ accounts: [{ address: 'ADDR' }] }),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    zeroBytes: (buffer: Uint16Array | null) => {
        buffer?.fill(0)
    },
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: () => ({ checkPinEnabled }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../../hooks', () => ({
    useMnemonicForAddress: () => ({ executeWithMnemonic }),
}))

import { useBackupReminderMnemonicScreen } from '../useBackupReminderMnemonicScreen'

describe('useBackupReminderMnemonicScreen', () => {
    beforeEach(() => {
        nav.reset()
    })

    it('re-reveals the mnemonic when the user returns from the verification screen', async () => {
        const { result } = renderHook(() => useBackupReminderMnemonicScreen())

        await waitFor(() => expect(result.current.wordIndices).not.toBeNull())
        expect(Array.from(result.current.wordIndices ?? [])).toEqual([
            10, 20, 30,
        ])

        // Forward to verification: onContinue zeroes the buffer.
        act(() => {
            result.current.onContinue()
        })
        expect(result.current.wordIndices).toBeNull()

        // Back to the screen: focus re-runs the loader.
        act(() => {
            nav.fireFocus()
        })
        await waitFor(() => expect(result.current.wordIndices).not.toBeNull())
        expect(Array.from(result.current.wordIndices ?? [])).toEqual([
            10, 20, 30,
        ])
    })

    it('zeroes the retained buffer when the screen unmounts', async () => {
        const { result, unmount } = renderHook(() =>
            useBackupReminderMnemonicScreen(),
        )

        await waitFor(() => expect(result.current.wordIndices).not.toBeNull())
        const retained = result.current.wordIndices!

        unmount()

        // Routing this wipe through a setState updater silently skipped it:
        // React does not invoke updaters on an unmounted fiber.
        expect(Array.from(retained)).toEqual([0, 0, 0])
    })

    it('zeroes the previous buffer when a re-fetch replaces it', async () => {
        const { result } = renderHook(() => useBackupReminderMnemonicScreen())

        await waitFor(() => expect(result.current.wordIndices).not.toBeNull())
        const first = result.current.wordIndices!

        act(() => {
            nav.fireFocus()
        })
        await waitFor(() => expect(result.current.wordIndices).not.toBe(first))

        expect(Array.from(first)).toEqual([0, 0, 0])
    })
})
