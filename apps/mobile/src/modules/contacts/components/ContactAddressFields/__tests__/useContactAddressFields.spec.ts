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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useContactAddressFields } from '../useContactAddressFields'

const mocks = vi.hoisted(() => ({
    request: vi.fn(),
    readText: vi.fn(),
    dismissKeyboard: vi.fn(),
}))

vi.mock('react-native', async importOriginal => ({
    ...(await importOriginal<typeof import('react-native')>()),
    Keyboard: { dismiss: mocks.dismissKeyboard },
}))

vi.mock('@hooks/useLanguage')

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ readText: mocks.readText }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.request }),
}))

vi.mock('@components/ConfirmActionContent', () => ({
    ConfirmActionContent: () => null,
}))

vi.mock('@modules/chain-ui', () => ({
    chainFamilyDisplay: (family: string) => ({ label: `label:${family}` }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: {
            list: () => [
                { id: 'algorand', family: 'algorand' },
                { id: 'ethereum', family: 'evm' },
            ],
        },
    }),
}))

const handlers = () => ({
    onAddressInputChange: vi.fn(),
    confirmReplacement: vi.fn(),
    cancelReplacement: vi.fn(),
})

describe('useContactAddressFields', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('scans for any registered chain', () => {
        const { result } = renderHook(() =>
            useContactAddressFields({
                pendingReplacement: undefined,
                ...handlers(),
            }),
        )

        expect(result.current.scanChainIds).toEqual(['algorand', 'ethereum'])
    })

    it('pastes the clipboard into the address field', async () => {
        mocks.readText.mockResolvedValue('0xB0B')
        const params = { pendingReplacement: undefined, ...handlers() }
        const { result } = renderHook(() => useContactAddressFields(params))

        await act(() => result.current.handlePaste())

        expect(params.onAddressInputChange).toHaveBeenCalledWith('0xB0B')
    })

    it('closes the keyboard so the confirmation is not hidden under it', async () => {
        mocks.request.mockResolvedValue(true)

        renderHook(() =>
            useContactAddressFields({
                pendingReplacement: { family: 'algorand', address: 'NEW' },
                ...handlers(),
            }),
        )

        await waitFor(() => expect(mocks.request).toHaveBeenCalled())
        expect(mocks.dismissKeyboard).toHaveBeenCalled()
    })

    it('replaces the held address once the user confirms', async () => {
        mocks.request.mockResolvedValue(true)
        const params = {
            pendingReplacement: { family: 'algorand' as const, address: 'NEW' },
            ...handlers(),
        }

        renderHook(() => useContactAddressFields(params))

        await waitFor(() =>
            expect(params.confirmReplacement).toHaveBeenCalled(),
        )
        expect(params.cancelReplacement).not.toHaveBeenCalled()
    })

    it('keeps the held address when the confirmation is declined or dismissed', async () => {
        mocks.request.mockResolvedValue(undefined)
        const params = {
            pendingReplacement: { family: 'evm' as const, address: '0xNEW' },
            ...handlers(),
        }

        renderHook(() => useContactAddressFields(params))

        await waitFor(() => expect(params.cancelReplacement).toHaveBeenCalled())
        expect(params.confirmReplacement).not.toHaveBeenCalled()
    })
})
