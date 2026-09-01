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

// The confirm/warning/submit behavior itself is covered by the shared
// `useRekeyConfirmScreen` consumers' specs; this spec pins the wrapper's own
// wiring — route params in, quantum success route out.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useRekeyToQuantumConfirmScreen } from '../useRekeyToQuantumConfirmScreen'

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({
        showError: vi.fn(),
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

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useFindAccountByAddress: (address: string) => {
            if (address === 'SRC') return { address: 'SRC', name: 'Source' }
            if (address === 'TGT') return { address: 'TGT', name: 'Target' }
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

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: vi.fn(),
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

describe('useRekeyToQuantumConfirmScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('handleConfirmPress submits the routed addresses and navigates to the quantum success screen', async () => {
        mockSubmitAsync.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useRekeyToQuantumConfirmScreen())

        await act(async () => {
            result.current.handleConfirmPress()
        })

        await waitFor(() => {
            expect(mockSubmitAsync).toHaveBeenCalledWith({
                sourceAddress: 'SRC',
                rekeyToAddress: 'TGT',
            })
        })
        expect(mockNavigate).toHaveBeenCalledWith('RekeyToQuantum', {
            screen: 'RekeyToQuantumSuccess',
            params: { sourceAddress: 'SRC' },
        })
    })
})
