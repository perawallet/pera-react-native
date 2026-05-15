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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useUndoRekeyConfirmScreen } from '../useUndoRekeyConfirmScreen'

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
            params: { sourceAddress: 'SRC' },
        }),
    }
})

vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: vi.fn() }),
}))

const mockSourceAccount = {
    address: 'SRC',
    name: 'Source',
    rekeyAddress: 'AUTH' as string | undefined,
}
const mockAuthAccount = { address: 'AUTH', name: 'Auth' }

let mockBaseType = 'Algo25'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useFindAccountByAddress: (address: string) => {
            if (address === 'SRC') return mockSourceAccount
            if (address === 'AUTH') return mockAuthAccount
            return undefined
        },
        baseTypeFor: () => mockBaseType,
    }
})

const mockSubmitAsync = vi.fn()
vi.mock('../../../../hooks/useSubmitRekeyMutation', () => ({
    useSubmitRekeyMutation: () => ({
        submitAsync: mockSubmitAsync,
        isPending: false,
    }),
}))

vi.mock('../../../../hooks/useRekeyTransactionFeeQuery', () => ({
    useRekeyTransactionFeeQuery: () => ({
        feeAlgos: new Decimal('0.001'),
        isPending: false,
    }),
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

describe('useUndoRekeyConfirmScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSourceAccount.rekeyAddress = 'AUTH'
        mockBaseType = 'Algo25'
        mockSubmitAsync.mockReset()
        mockRequestBottomSheet.mockReset()
    })

    it('returns feeAlgos from the rekey transaction fee query', () => {
        const { result } = renderHook(() => useUndoRekeyConfirmScreen())

        expect(result.current.feeAlgos).toBeInstanceOf(Decimal)
        expect(result.current.feeAlgos?.toString()).toBe('0.001')
    })

    it('handleContinuePress always requests the warning sheet (no preview-rekey branch)', async () => {
        mockRequestBottomSheet.mockReturnValueOnce(new Promise(() => {}))
        const { result } = renderHook(() => useUndoRekeyConfirmScreen())

        await act(async () => {
            result.current.handleContinuePress()
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(mockSubmitAsync).not.toHaveBeenCalled()
    })

    it('submits with source.address as rekey-to address and navigates on success when confirmed', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(true)
        mockSubmitAsync.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useUndoRekeyConfirmScreen())

        await act(async () => {
            result.current.handleContinuePress()
        })

        await waitFor(() => {
            expect(mockSubmitAsync).toHaveBeenCalledWith({
                sourceAddress: 'SRC',
                rekeyToAddress: 'SRC',
            })
        })
        expect(mockNavigate).toHaveBeenCalledWith('UndoRekey', {
            screen: 'UndoRekeySuccess',
            params: { sourceAddress: 'SRC' },
        })
    })

    it('does not submit when the warning sheet resolves with false', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(false)
        const { result } = renderHook(() => useUndoRekeyConfirmScreen())

        await act(async () => {
            result.current.handleContinuePress()
        })

        expect(mockSubmitAsync).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('uses the regular warning variant when the source will retain auth', async () => {
        mockRequestBottomSheet.mockReturnValueOnce(new Promise(() => {}))
        const { result } = renderHook(() => useUndoRekeyConfirmScreen())

        await act(async () => {
            result.current.handleContinuePress()
        })

        const { contents } = mockRequestBottomSheet.mock.calls[0][0]
        expect(contents.props.i18nPrefix).toBe('rekey.undo.warning')
        expect(contents.props.confirmVariant).toBe('primary')
    })

    it('uses the destructive no-auth warning variant when the source will become no-auth', async () => {
        mockBaseType = 'NoAuth'
        mockRequestBottomSheet.mockReturnValueOnce(new Promise(() => {}))
        const { result } = renderHook(() => useUndoRekeyConfirmScreen())

        await act(async () => {
            result.current.handleContinuePress()
        })

        const { contents } = mockRequestBottomSheet.mock.calls[0][0]
        expect(contents.props.i18nPrefix).toBe('rekey.undo.no_auth_warning')
        expect(contents.props.confirmVariant).toBe('destructive')
    })

    it('shows the user-rejected toast and does not navigate when the signer cancels', async () => {
        const { RekeyError } = await import('../../../../utils/RekeyError')
        mockRequestBottomSheet.mockResolvedValueOnce(true)
        mockSubmitAsync.mockRejectedValueOnce(new RekeyError('user_rejected'))
        const { result } = renderHook(() => useUndoRekeyConfirmScreen())

        await act(async () => {
            result.current.handleContinuePress()
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
        mockRequestBottomSheet.mockResolvedValueOnce(true)
        mockSubmitAsync.mockRejectedValueOnce(new Error('boom'))
        const { result } = renderHook(() => useUndoRekeyConfirmScreen())

        await act(async () => {
            result.current.handleContinuePress()
        })

        await waitFor(() => {
            expect(mockShowError).toHaveBeenCalled()
        })
        expect(mockNavigate).not.toHaveBeenCalled()
    })
})
