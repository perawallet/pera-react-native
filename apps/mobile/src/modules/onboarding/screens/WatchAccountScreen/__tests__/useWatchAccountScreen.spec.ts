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
import { useWatchAccountScreen } from '../useWatchAccountScreen'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockNavigate = vi.fn()
const mockGoBack = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        goBack: mockGoBack,
    }),
}))

const mockSetAccounts = vi.fn()
const mockSetSelectedAccountAddress = vi.fn()
const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAllAccounts: () => mockUseAllAccounts(),
        useAccountsStore: (selector: (state: unknown) => unknown) => {
            const state = {
                setAccounts: mockSetAccounts,
                setSelectedAccountAddress: mockSetSelectedAccountAddress,
            }
            return selector(state)
        },
    }
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

const mockShowToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        generateOrderedUniqueId: () => 'mock-uuid',
    }
})

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<object>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => key,
            i18n: {
                changeLanguage: vi.fn(),
                language: 'en',
            },
        }),
    }
})

describe('useWatchAccountScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
    })

    it('initializes with empty address and invalid state', () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        expect(result.current.address).toBe('')
        expect(result.current.isValidAddress).toBe(false)
    })

    it('handleAddressChange updates address', () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('some-address')
        })

        expect(result.current.address).toBe('some-address')
    })

    it('isValidAddress reflects address validity', () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('invalid')
        })
        expect(result.current.isValidAddress).toBe(false)

        act(() => {
            result.current.handleAddressChange('VALID_ALGORAND_ADDRESS')
        })
        expect(result.current.isValidAddress).toBe(true)
    })

    it('handleWatchAccount shows error toast for invalid address', () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('invalid-address')
        })

        act(() => {
            result.current.handleWatchAccount()
        })

        expect(mockSetAccounts).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })

    it('handleWatchAccount creates watch account for valid address', () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('VALID_ALGORAND_ADDRESS')
        })

        act(() => {
            result.current.handleWatchAccount()
        })

        expect(mockSetAccounts).toHaveBeenCalledWith([
            {
                id: 'mock-uuid',
                address: 'VALID_ALGORAND_ADDRESS',
                type: 'watch',
                canSign: false,
            },
        ])
        expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith(
            'VALID_ALGORAND_ADDRESS',
        )
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'success',
            }),
        )
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Home' })
    })

    it('handleWatchAccount shows error for duplicate address', () => {
        mockUseAllAccounts.mockReturnValue([
            {
                id: 'existing',
                address: 'VALID_ALGORAND_ADDRESS',
                type: 'watch',
                canSign: false,
            } as WalletAccount,
        ])

        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('VALID_ALGORAND_ADDRESS')
        })

        act(() => {
            result.current.handleWatchAccount()
        })

        expect(mockSetAccounts).not.toHaveBeenCalled()
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('handleWatchAccount appends to existing accounts', () => {
        const existingAccount = {
            id: 'existing',
            address: 'OTHER_ADDRESS',
            type: 'watch',
            canSign: false,
        } as WalletAccount

        mockUseAllAccounts.mockReturnValue([existingAccount])

        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('VALID_ALGORAND_ADDRESS')
        })

        act(() => {
            result.current.handleWatchAccount()
        })

        expect(mockSetAccounts).toHaveBeenCalledWith([
            existingAccount,
            {
                id: 'mock-uuid',
                address: 'VALID_ALGORAND_ADDRESS',
                type: 'watch',
                canSign: false,
            },
        ])
    })
})
