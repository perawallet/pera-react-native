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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppState } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useClipboardAddress } from '../useClipboardAddress'

vi.mock('expo-clipboard', () => ({
    getStringAsync: vi.fn(),
}))

const mockRemove = vi.fn()
vi.spyOn(AppState, 'addEventListener').mockReturnValue({
    remove: mockRemove,
})

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        isValidAlgorandAddress: (address?: string) =>
            address === 'VALID_ALGORAND_ADDRESS',
    }
})

describe('useClipboardAddress', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns null when clipboard is empty', async () => {
        vi.mocked(Clipboard.getStringAsync).mockResolvedValue('')

        const { result } = renderHook(() => useClipboardAddress())

        await act(async () => {})

        expect(result.current.clipboardAddress).toBeNull()
    })

    it('returns null when clipboard contains invalid address', async () => {
        vi.mocked(Clipboard.getStringAsync).mockResolvedValue('not-an-address')

        const { result } = renderHook(() => useClipboardAddress())

        await act(async () => {})

        expect(result.current.clipboardAddress).toBeNull()
    })

    it('returns address when clipboard contains valid Algorand address', async () => {
        vi.mocked(Clipboard.getStringAsync).mockResolvedValue(
            'VALID_ALGORAND_ADDRESS',
        )

        const { result } = renderHook(() => useClipboardAddress())

        await act(async () => {})

        expect(result.current.clipboardAddress).toBe('VALID_ALGORAND_ADDRESS')
    })

    it('trims whitespace from clipboard content', async () => {
        vi.mocked(Clipboard.getStringAsync).mockResolvedValue(
            '  VALID_ALGORAND_ADDRESS  ',
        )

        const { result } = renderHook(() => useClipboardAddress())

        await act(async () => {})

        expect(result.current.clipboardAddress).toBe('VALID_ALGORAND_ADDRESS')
    })

    it('returns null when clipboard read fails', async () => {
        vi.mocked(Clipboard.getStringAsync).mockRejectedValue(
            new Error('Permission denied'),
        )

        const { result } = renderHook(() => useClipboardAddress())

        await act(async () => {})

        expect(result.current.clipboardAddress).toBeNull()
    })

    it('refreshClipboard updates the address', async () => {
        vi.mocked(Clipboard.getStringAsync).mockResolvedValue('')

        const { result } = renderHook(() => useClipboardAddress())

        await act(async () => {})
        expect(result.current.clipboardAddress).toBeNull()

        vi.mocked(Clipboard.getStringAsync).mockResolvedValue(
            'VALID_ALGORAND_ADDRESS',
        )

        await act(async () => {
            await result.current.refreshClipboard()
        })

        expect(result.current.clipboardAddress).toBe('VALID_ALGORAND_ADDRESS')
    })
})
