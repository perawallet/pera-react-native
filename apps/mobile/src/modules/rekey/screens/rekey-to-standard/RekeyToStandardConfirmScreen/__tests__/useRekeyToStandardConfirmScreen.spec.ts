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
import { renderHook, act, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useRekeyToStandardConfirmScreen } from '../useRekeyToStandardConfirmScreen'

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
    }),
}))

const mockShowToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

const mockShowError = vi.fn()
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({
        showError: mockShowError,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useRoute: () => ({
            params: { sourceAddress: 'SRC', targetAddress: 'TGT' },
        }),
    }
})

vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: vi.fn() }),
}))

const mockSourceAccount = {
    address: 'SRC',
    name: 'Source',
    rekeyAddress: undefined as string | undefined,
}
const mockTargetAccount = { address: 'TGT', name: 'Target' }
const mockAuthAccount = { address: 'AUTH', name: 'Auth' }

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useFindAccountByAddress: (address: string) => {
            if (address === 'SRC') return mockSourceAccount
            if (address === 'TGT') return mockTargetAccount
            if (address === 'AUTH') return mockAuthAccount
            return undefined
        },
    }
})

const mockSubmitAsync = vi.fn()
vi.mock('@perawallet/wallet-core-transactions', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-transactions')
    >()),
    useSubmitRekeyMutation: () => ({
        submitAsync: mockSubmitAsync,
        isPending: false,
    }),
    useRekeyTransactionFeeQuery: () => ({
        feeAlgos: new Decimal('0.001'),
        isPending: false,
    }),
    useRekeyFeePreflight: () => ({ isUnderfunded: false }),
}))

const mockRequestBottomSheet = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

describe('useRekeyToStandardConfirmScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSourceAccount.rekeyAddress = undefined
        mockSubmitAsync.mockReset()
        mockRequestBottomSheet.mockReset()
    })

    it('returns feeAlgos from the rekey transaction fee query', () => {
        const { result } = renderHook(() => useRekeyToStandardConfirmScreen())

        expect(result.current.feeAlgos).toBeInstanceOf(Decimal)
        expect(result.current.feeAlgos?.toString()).toBe('0.001')
    })

    it('handleConfirmPress submits and navigates on success when no previous rekey exists', async () => {
        mockSubmitAsync.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useRekeyToStandardConfirmScreen())

        await act(async () => {
            result.current.handleConfirmPress()
        })

        await waitFor(() => {
            expect(mockSubmitAsync).toHaveBeenCalledWith({
                sourceAddress: 'SRC',
                rekeyToAddress: 'TGT',
            })
        })
        expect(mockNavigate).toHaveBeenCalledWith('RekeyToStandard', {
            screen: 'RekeyToStandardSuccess',
            params: { sourceAddress: 'SRC' },
        })
    })

    it('handleConfirmPress requests the warning sheet without submitting when source has a previous rekey', async () => {
        mockSourceAccount.rekeyAddress = 'AUTH'
        mockRequestBottomSheet.mockReturnValueOnce(new Promise(() => {}))
        const { result } = renderHook(() => useRekeyToStandardConfirmScreen())

        await act(async () => {
            result.current.handleConfirmPress()
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(mockSubmitAsync).not.toHaveBeenCalled()
    })

    it('submits after the warning sheet resolves with true', async () => {
        mockSourceAccount.rekeyAddress = 'AUTH'
        mockRequestBottomSheet.mockResolvedValueOnce(true)
        mockSubmitAsync.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useRekeyToStandardConfirmScreen())

        await act(async () => {
            result.current.handleConfirmPress()
        })

        await waitFor(() => {
            expect(mockSubmitAsync).toHaveBeenCalledTimes(1)
        })
    })

    it('does not submit when the warning sheet resolves with false', async () => {
        mockSourceAccount.rekeyAddress = 'AUTH'
        mockRequestBottomSheet.mockResolvedValueOnce(false)
        const { result } = renderHook(() => useRekeyToStandardConfirmScreen())

        await act(async () => {
            result.current.handleConfirmPress()
        })

        expect(mockSubmitAsync).not.toHaveBeenCalled()
    })

    it('shows the user-rejected toast and does not navigate when the signer cancels', async () => {
        const { RekeyError } =
            await import('@perawallet/wallet-core-transactions')
        mockSubmitAsync.mockRejectedValueOnce(new RekeyError('user_rejected'))
        const { result } = renderHook(() => useRekeyToStandardConfirmScreen())

        await act(async () => {
            result.current.handleConfirmPress()
        })

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' }),
            )
        })
        expect(mockShowError).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('calls showError and does not navigate on generic errors', async () => {
        mockSubmitAsync.mockRejectedValueOnce(new Error('boom'))
        const { result } = renderHook(() => useRekeyToStandardConfirmScreen())

        await act(async () => {
            result.current.handleConfirmPress()
        })

        await waitFor(() => {
            expect(mockShowError).toHaveBeenCalled()
        })
        expect(mockNavigate).not.toHaveBeenCalled()
    })
})
