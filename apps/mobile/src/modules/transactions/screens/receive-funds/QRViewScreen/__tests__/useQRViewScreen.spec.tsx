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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useQRViewScreen } from '../useQRViewScreen'
import { shareText } from '@utils/shareText'
import { useReceiveFunds } from '@modules/transactions/hooks'
import { useErrorToast } from '@hooks/useErrorToast'
import { useClipboard } from '@hooks/useClipboard'
import { useDeepLink } from '@hooks/useDeepLink'

vi.mock('@modules/transactions/hooks', () => ({
    useReceiveFunds: vi.fn(),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: vi.fn(),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: vi.fn(),
}))

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

vi.mock('@utils/shareText', () => ({
    shareText: vi.fn(),
}))

const mockAccount = {
    address: 'test-address-123',
    name: 'Test Account',
    type: 'watch' as const,
}

describe('useQRViewScreen', () => {
    const mockShowError = vi.fn()
    const mockCopyToClipboard = vi.fn()
    const mockBuildAccountDeeplink = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useReceiveFunds as Mock).mockReturnValue({
            selectedAccount: mockAccount,
        })
        ;(useErrorToast as Mock).mockReturnValue({
            showError: mockShowError,
        })
        ;(useClipboard as Mock).mockReturnValue({
            copyToClipboard: mockCopyToClipboard,
        })
        mockBuildAccountDeeplink.mockReturnValue('algorand://test-address-123')
        ;(useDeepLink as Mock).mockReturnValue({
            buildAccountDeeplink: mockBuildAccountDeeplink,
        })
    })

    it('returns account from store', () => {
        const { result } = renderHook(() => useQRViewScreen())

        expect(result.current.account).toEqual(mockAccount)
    })

    it('returns empty deeplink when no account', () => {
        ;(useReceiveFunds as Mock).mockReturnValue({
            selectedAccount: undefined,
        })

        const { result } = renderHook(() => useQRViewScreen())

        expect(result.current.deeplink).toBe('')
    })

    it('returns deeplink for account', () => {
        const { result } = renderHook(() => useQRViewScreen())

        expect(result.current.deeplink).toBe('algorand://test-address-123')
        expect(mockBuildAccountDeeplink).toHaveBeenCalledWith(mockAccount)
    })

    it('copies address to clipboard', () => {
        const { result } = renderHook(() => useQRViewScreen())

        act(() => {
            result.current.handleCopyAddress()
        })

        expect(mockCopyToClipboard).toHaveBeenCalledWith('test-address-123')
    })

    it('copies empty string when no account', () => {
        ;(useReceiveFunds as Mock).mockReturnValue({
            selectedAccount: undefined,
        })

        const { result } = renderHook(() => useQRViewScreen())

        act(() => {
            result.current.handleCopyAddress()
        })

        expect(mockCopyToClipboard).toHaveBeenCalledWith('')
    })

    it('shares address via shareText', async () => {
        vi.mocked(shareText).mockResolvedValue()

        const { result } = renderHook(() => useQRViewScreen())

        await act(async () => {
            await result.current.handleShareAddress()
        })

        expect(shareText).toHaveBeenCalledWith({
            title: 'Test Account',
            message: 'test-address-123',
        })
    })

    it('does not share when no account', async () => {
        ;(useReceiveFunds as Mock).mockReturnValue({
            selectedAccount: undefined,
        })

        const { result } = renderHook(() => useQRViewScreen())

        await act(async () => {
            await result.current.handleShareAddress()
        })

        expect(shareText).not.toHaveBeenCalled()
    })

    it('shows toast on share error', async () => {
        const shareError = new Error('Share failed')
        vi.mocked(shareText).mockRejectedValue(shareError)

        const { result } = renderHook(() => useQRViewScreen())

        await act(async () => {
            await result.current.handleShareAddress()
        })

        expect(mockShowError).toHaveBeenCalledWith(
            shareError,
            'errors.general.title',
            expect.anything(),
        )
    })
})
