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
import { renderHook, act } from '@test-utils/render'
import { useRevealPrivateKeyFlow } from '../useRevealPrivateKeyFlow'

const mocks = vi.hoisted(() => ({
    requirePinVerification: vi.fn(),
    requestBottomSheet: vi.fn(),
    revealPrivateKey: vi.fn(),
    showError: vi.fn(),
}))

vi.mock('@modules/security', () => ({
    useRequirePinVerification: () => ({
        requirePinVerification: mocks.requirePinVerification,
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mocks.requestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mocks.showError }),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-accounts')),
    useRevealPrivateKey: () => ({ revealPrivateKey: mocks.revealPrivateKey }),
}))

vi.mock('../../RevealPrivateKeyContent', () => ({
    RevealPrivateKeyContent: () => null,
}))

const CHAIN_ID = 'algorand'

describe('useRevealPrivateKeyFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requestBottomSheet.mockResolvedValue(undefined)
    })

    it('authenticates through the PIN gate before reading the key', async () => {
        mocks.revealPrivateKey.mockResolvedValue(null)
        const { result } = renderHook(() => useRevealPrivateKeyFlow())

        await act(async () => {
            await result.current.openRevealPrivateKeyFlow('acc-1', CHAIN_ID)
        })

        expect(mocks.revealPrivateKey).toHaveBeenCalledWith(
            'acc-1',
            mocks.requirePinVerification,
        )
    })

    it('opens no sheet when the PIN gate is not passed', async () => {
        mocks.revealPrivateKey.mockResolvedValue(null)
        const { result } = renderHook(() => useRevealPrivateKeyFlow())

        await act(async () => {
            await result.current.openRevealPrivateKeyFlow('acc-1', CHAIN_ID)
        })

        expect(mocks.requestBottomSheet).not.toHaveBeenCalled()
        expect(mocks.showError).not.toHaveBeenCalled()
    })

    it('shows the key in a sheet and zeroes it once the sheet closes', async () => {
        const key = Uint8Array.of(1, 2, 3)
        mocks.revealPrivateKey.mockResolvedValue(key)
        let closeSheet!: () => void
        mocks.requestBottomSheet.mockReturnValue(
            new Promise<void>(resolve => {
                closeSheet = resolve
            }),
        )
        const { result } = renderHook(() => useRevealPrivateKeyFlow())

        let flow!: Promise<void>
        await act(async () => {
            flow = result.current.openRevealPrivateKeyFlow('acc-1', CHAIN_ID)
        })

        expect(mocks.requestBottomSheet).toHaveBeenCalledTimes(1)
        expect(Array.from(key)).toEqual([1, 2, 3])

        await act(async () => {
            closeSheet()
            await flow
        })

        expect(Array.from(key)).toEqual([0, 0, 0])
    })

    it('shows the error toast when the key cannot be read', async () => {
        const error = new Error('no key')
        mocks.revealPrivateKey.mockRejectedValue(error)
        const { result } = renderHook(() => useRevealPrivateKeyFlow())

        await act(async () => {
            await result.current.openRevealPrivateKeyFlow('acc-1', CHAIN_ID)
        })

        expect(mocks.showError).toHaveBeenCalledWith(
            error,
            'reveal_private_key.error_title',
        )
        expect(mocks.requestBottomSheet).not.toHaveBeenCalled()
    })
})
