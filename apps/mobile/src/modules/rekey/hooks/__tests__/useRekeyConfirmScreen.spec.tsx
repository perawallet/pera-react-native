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
import { useRekeyConfirmScreen } from '../useRekeyConfirmScreen'

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate, goBack: vi.fn() }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: vi.fn() }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: vi.fn() }),
}))

// A quantum source, an Ed25519 target, and a quantum target. `type` drives the
// real `isQuantumDowngrade` helper (kept unmocked below).
const mockQuantumSource = {
    address: 'SRC',
    name: 'Quantum Source',
    type: 'quantum',
    keyPairId: 'kp-src',
    rekeyAddress: undefined as string | undefined,
}
const mockEd25519Source = {
    address: 'SRC',
    name: 'Standard Source',
    type: 'algo25',
    keyPairId: 'kp-src',
    rekeyAddress: undefined as string | undefined,
}
const mockEd25519Target = {
    address: 'TGT',
    name: 'Standard Target',
    type: 'algo25',
    keyPairId: 'kp-tgt',
}
const mockQuantumTarget = {
    address: 'TGT',
    name: 'Quantum Target',
    type: 'quantum',
    keyPairId: 'kp-tgt',
}

// Swapped per-test so useFindAccountByAddress / useAllAccounts reflect the case.
let currentSource: Record<string, unknown> = mockQuantumSource
let currentTarget: Record<string, unknown> = mockEd25519Target

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useFindAccountByAddress: (address: string) => {
            if (address === 'SRC') return currentSource
            if (address === 'TGT') return currentTarget
            return undefined
        },
        useAllAccounts: () => [currentSource, currentTarget],
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

const config = {
    sourceAddress: 'SRC',
    targetAddress: 'TGT',
    supportUrl: 'https://support.example',
    warningI18nPrefix: 'rekey.to_standard.confirm.replace_warning',
    warningTestID: 'rekey-to-standard-previous-rekey-warning-sheet',
    onSubmitSuccess: vi.fn(),
}

describe('useRekeyConfirmScreen - quantum downgrade gate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSubmitAsync.mockReset()
        mockRequestBottomSheet.mockReset()
        currentSource = mockQuantumSource
        currentTarget = mockEd25519Target
        mockQuantumSource.rekeyAddress = undefined
        mockEd25519Source.rekeyAddress = undefined
    })

    it('requests the downgrade warning and gates submit when a quantum source rekeys to an Ed25519 target', async () => {
        currentSource = mockQuantumSource
        currentTarget = mockEd25519Target
        // Never resolves — the sheet is open awaiting the user.
        mockRequestBottomSheet.mockReturnValueOnce(new Promise(() => {}))

        const { result } = renderHook(() => useRekeyConfirmScreen(config))

        await act(async () => {
            result.current.handleConfirmPress()
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(mockSubmitAsync).not.toHaveBeenCalled()
    })

    it('submits after the downgrade warning resolves with true', async () => {
        currentSource = mockQuantumSource
        currentTarget = mockEd25519Target
        mockRequestBottomSheet.mockResolvedValueOnce(true)
        mockSubmitAsync.mockResolvedValueOnce(undefined)

        const { result } = renderHook(() => useRekeyConfirmScreen(config))

        await act(async () => {
            result.current.handleConfirmPress()
        })

        await waitFor(() => {
            expect(mockSubmitAsync).toHaveBeenCalledWith({
                sourceAddress: 'SRC',
                rekeyToAddress: 'TGT',
            })
        })
    })

    it('does not submit when the downgrade warning resolves with false', async () => {
        currentSource = mockQuantumSource
        currentTarget = mockEd25519Target
        mockRequestBottomSheet.mockResolvedValueOnce(false)

        const { result } = renderHook(() => useRekeyConfirmScreen(config))

        await act(async () => {
            result.current.handleConfirmPress()
        })

        expect(mockSubmitAsync).not.toHaveBeenCalled()
    })

    it('does not request the downgrade warning when the target is also quantum', async () => {
        currentSource = mockQuantumSource
        currentTarget = mockQuantumTarget
        mockSubmitAsync.mockResolvedValueOnce(undefined)

        const { result } = renderHook(() => useRekeyConfirmScreen(config))

        await act(async () => {
            result.current.handleConfirmPress()
        })

        await waitFor(() => {
            expect(mockSubmitAsync).toHaveBeenCalledTimes(1)
        })
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })

    it('does not request the downgrade warning when the source is not quantum', async () => {
        currentSource = mockEd25519Source
        currentTarget = mockQuantumTarget
        mockSubmitAsync.mockResolvedValueOnce(undefined)

        const { result } = renderHook(() => useRekeyConfirmScreen(config))

        await act(async () => {
            result.current.handleConfirmPress()
        })

        await waitFor(() => {
            expect(mockSubmitAsync).toHaveBeenCalledTimes(1)
        })
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })
})

describe('useRekeyConfirmScreen - no-op rekey guard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSubmitAsync.mockReset()
        mockRequestBottomSheet.mockReset()
        mockEd25519Source.rekeyAddress = undefined
    })

    it("does not submit when the target is already the source's current auth", async () => {
        currentSource = { ...mockEd25519Source, rekeyAddress: 'TGT' }
        currentTarget = mockEd25519Target
        // Drive past the previous-rekey warning so only the guard can block.
        mockRequestBottomSheet.mockResolvedValue(true)

        const { result } = renderHook(() => useRekeyConfirmScreen(config))

        await act(async () => {
            result.current.handleConfirmPress()
        })

        expect(mockSubmitAsync).not.toHaveBeenCalled()
    })

    it('submits when a previously rekeyed source targets a different account', async () => {
        currentSource = { ...mockEd25519Source, rekeyAddress: 'OTHER' }
        currentTarget = mockEd25519Target
        mockRequestBottomSheet.mockResolvedValue(true)
        mockSubmitAsync.mockResolvedValueOnce(undefined)

        const { result } = renderHook(() => useRekeyConfirmScreen(config))

        await act(async () => {
            result.current.handleConfirmPress()
        })

        await waitFor(() => {
            expect(mockSubmitAsync).toHaveBeenCalledWith({
                sourceAddress: 'SRC',
                rekeyToAddress: 'TGT',
            })
        })
    })
})
