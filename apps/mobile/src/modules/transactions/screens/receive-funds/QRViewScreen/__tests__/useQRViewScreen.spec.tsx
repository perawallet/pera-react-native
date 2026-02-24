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
import { Share } from 'react-native'
import { useQRViewScreen } from '../useQRViewScreen'
import { useReceiveFunds } from '@modules/transactions/hooks'
import { useToast } from '@hooks/useToast'
import { useClipboard } from '@hooks/useClipboard'
import { useDeepLink } from '@hooks/useDeepLink'

vi.mock('@modules/transactions/hooks', () => ({
    useReceiveFunds: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(),
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

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { debugEnabled: false },
}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

vi.mock('react-native', async () => {
    const actual = await vi.importActual('react-native')
    return {
        ...actual,
        Share: {
            share: vi.fn(),
        },
    }
})

const mockAccount = {
    address: 'test-address-123',
    name: 'Test Account',
    type: 'watch' as const,
}

describe('useQRViewScreen', () => {
    const mockShowToast = vi.fn()
    const mockCopyToClipboard = vi.fn()
    const mockBuildAccountDeeplink = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useReceiveFunds as Mock).mockReturnValue({
            selectedAccount: mockAccount,
        })
        ;(useToast as Mock).mockReturnValue({
            showToast: mockShowToast,
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

    it('shares address', async () => {
        const shareSpy = vi
            .spyOn(Share, 'share')
            .mockResolvedValue({ action: 'sharedAction' })

        const { result } = renderHook(() => useQRViewScreen())

        await act(async () => {
            await result.current.handleShareAddress()
        })

        expect(shareSpy).toHaveBeenCalledWith({
            title: 'Test Account',
            message: 'test-address-123',
        })
    })

    it('does not share when no account', async () => {
        ;(useReceiveFunds as Mock).mockReturnValue({
            selectedAccount: undefined,
        })

        const shareSpy = vi.spyOn(Share, 'share')

        const { result } = renderHook(() => useQRViewScreen())

        await act(async () => {
            await result.current.handleShareAddress()
        })

        expect(shareSpy).not.toHaveBeenCalled()
    })

    it('shows toast on share error', async () => {
        vi.spyOn(Share, 'share').mockRejectedValue(new Error('Share failed'))

        const { result } = renderHook(() => useQRViewScreen())

        await act(async () => {
            await result.current.handleShareAddress()
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            expect.anything(),
        )
    })
})
