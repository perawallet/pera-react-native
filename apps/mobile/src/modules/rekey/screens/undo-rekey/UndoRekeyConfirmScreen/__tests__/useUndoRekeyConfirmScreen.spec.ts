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
    type: 'algo25' as 'algo25' | 'watch',
    rekeyAddress: 'AUTH' as string | undefined,
}
const mockAuthAccount = { address: 'AUTH', name: 'Auth', type: 'algo25' }

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
    }
})

const mockSubmitAsync = vi.fn()
let mockIsUnderfunded = false
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
    useRekeyFeePreflight: () => ({ isUnderfunded: mockIsUnderfunded }),
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

// Capture the handler registered with useSigningEvent so tests can simulate a
// signing event firing on the bus.
let capturedSigningHandler: ((event: unknown) => void) | null = null
vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-signing')
    >()),
    useSigningEvent: (
        _predicate: unknown,
        handler: (event: unknown) => void,
    ) => {
        capturedSigningHandler = handler
    },
}))

describe('useUndoRekeyConfirmScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSourceAccount.rekeyAddress = 'AUTH'
        mockSourceAccount.type = 'algo25'
        mockSubmitAsync.mockReset()
        mockRequestBottomSheet.mockReset()
        capturedSigningHandler = null
        mockIsUnderfunded = false
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

    it('a second tap while the flow is in flight is a no-op (no second sheet, one submission)', async () => {
        mockRequestBottomSheet.mockResolvedValue(true)
        mockSubmitAsync.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useUndoRekeyConfirmScreen())

        await act(async () => {
            void result.current.handleContinuePress()
            void result.current.handleContinuePress()
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(mockSubmitAsync).toHaveBeenCalledTimes(1)
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

    it('hands off to the pending-signatures flow on multisig propose without showing success', async () => {
        // Undoing the rekey of a shared account is a multisig propose:
        // submitAsync never resolves (it surfaces via the 'proposed' signing
        // event). The flow must exit to Home for the pending-signatures sheet
        // to take over, not hang or show the success screen.
        mockRequestBottomSheet.mockResolvedValueOnce(true)
        mockSubmitAsync.mockReturnValueOnce(new Promise(() => {}))
        const { result } = renderHook(() => useUndoRekeyConfirmScreen())

        await act(async () => {
            result.current.handleContinuePress()
        })

        await waitFor(() => expect(mockSubmitAsync).toHaveBeenCalled())

        act(() => {
            capturedSigningHandler?.({
                type: 'transport-result',
                result: {
                    type: 'proposed',
                    signRequestId: 'sr-1',
                    status: 'pending',
                    sourceType: 'local',
                },
            })
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Home' })
        expect(mockNavigate).not.toHaveBeenCalledWith(
            'UndoRekey',
            expect.objectContaining({ screen: 'UndoRekeySuccess' }),
        )
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
        mockSourceAccount.type = 'watch'
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
        const { RekeyError } =
            await import('@perawallet/wallet-core-transactions')
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

    it('exposes the underfunded state and blocks handleContinuePress when underfunded', async () => {
        mockIsUnderfunded = true
        const { result } = renderHook(() => useUndoRekeyConfirmScreen())

        expect(result.current.isUnderfunded).toBe(true)

        await act(async () => {
            result.current.handleContinuePress()
        })

        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
        expect(mockSubmitAsync).not.toHaveBeenCalled()
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
