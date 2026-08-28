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

import { describe, test, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { bottomSheetNotifier } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useClipboard } from '@hooks/useClipboard'
import { useEncryptionKeyConfirmSheet } from '../useEncryptionKeyConfirmSheet'

const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='

vi.mock('@perawallet/wallet-core-backup', () => ({
    useCloudBackupDraftStore: vi.fn(
        (selector: (s: { salt: string | null }) => unknown) =>
            selector({ salt: SALT }),
    ),
}))

// A stand-in for the notifier PWBottomSheet mounts inside the sheet; toasts
// handed the global one instead render behind it.
vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: { id: 'sheet-notifier' } },
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: vi.fn(),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: vi.fn(),
}))

const mockResolve = vi.fn()
const mockCopyToClipboard = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    ;(useBottomSheetResult as Mock).mockReturnValue({
        resolve: mockResolve,
        dismiss: vi.fn(),
    })
    ;(useClipboard as Mock).mockReturnValue({
        copyToClipboard: mockCopyToClipboard,
        readText: vi.fn(),
    })
})

describe('useEncryptionKeyConfirmSheet', () => {
    test('exposes the draft salt and starts unconfirmed', () => {
        const { result } = renderHook(() => useEncryptionKeyConfirmSheet())

        expect(result.current.salt).toBe(SALT)
        expect(result.current.isConfirmed).toBe(false)
    })

    test('toggleConfirmed flips the confirmation flag', () => {
        const { result } = renderHook(() => useEncryptionKeyConfirmSheet())

        act(() => result.current.toggleConfirmed())

        expect(result.current.isConfirmed).toBe(true)
    })

    test('copies the salt through the in-sheet notifier', () => {
        const { result } = renderHook(() => useEncryptionKeyConfirmSheet())

        result.current.handleCopy()

        expect(mockCopyToClipboard).toHaveBeenCalledWith(
            SALT,
            bottomSheetNotifier.current,
        )
    })

    test('resolves with "enable" / "show-credentials"', () => {
        const { result } = renderHook(() => useEncryptionKeyConfirmSheet())

        result.current.handleEnable()
        expect(mockResolve).toHaveBeenCalledWith('enable')

        result.current.handleShowCredentials()
        expect(mockResolve).toHaveBeenCalledWith('show-credentials')
    })
})
