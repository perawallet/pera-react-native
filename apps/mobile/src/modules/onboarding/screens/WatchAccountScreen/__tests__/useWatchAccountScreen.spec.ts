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
import { useNfdSearch } from '@perawallet/wallet-core-nfd'

const mockNavigate = vi.fn()
const mockPush = vi.fn()
const mockGoBack = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        push: mockPush,
        goBack: mockGoBack,
    }),
}))

const mockSetAccounts = vi.fn()
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

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        generateOrderedUniqueId: () => 'mock-uuid',
    }
})

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdSearch: vi.fn(() => ({ results: [], isLoading: false })),
}))

vi.mock('@hooks/useDebouncedValue', () => ({
    useDebouncedValue: (value: string) => value,
}))

describe('useWatchAccountScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
        vi.mocked(useNfdSearch).mockReturnValue({
            results: [],
            isLoading: false,
            isError: false,
            error: null,
        })
    })

    it('initializes with empty address and invalid state', () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        expect(result.current.address).toBe('')
        expect(result.current.isValidAddress).toBe(false)
        expect(result.current.isDuplicateAddress).toBe(false)
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

    it('isDuplicateAddress is true when address already exists', () => {
        mockUseAllAccounts.mockReturnValue([
            {
                id: 'existing',
                address: 'VALID_ALGORAND_ADDRESS',
                type: 'watch',
            } as WalletAccount,
        ])

        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('VALID_ALGORAND_ADDRESS')
        })

        expect(result.current.isDuplicateAddress).toBe(true)
    })

    it('isDuplicateAddress is false for invalid address even if it exists', () => {
        mockUseAllAccounts.mockReturnValue([
            {
                id: 'existing',
                address: 'invalid',
                type: 'watch',
            } as WalletAccount,
        ])

        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('invalid')
        })

        expect(result.current.isDuplicateAddress).toBe(false)
    })

    it('handleWatchAccount does nothing for invalid address', () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('invalid-address')
        })

        act(() => {
            result.current.handleWatchAccount()
        })

        expect(mockSetAccounts).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('handleWatchAccount does nothing for duplicate address', () => {
        mockUseAllAccounts.mockReturnValue([
            {
                id: 'existing',
                address: 'VALID_ALGORAND_ADDRESS',
                type: 'watch',
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
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('handleWatchAccount creates watch account and navigates to NameAccount', () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('VALID_ALGORAND_ADDRESS')
        })

        act(() => {
            result.current.handleWatchAccount()
        })

        const expectedAccount = {
            id: 'mock-uuid',
            address: 'VALID_ALGORAND_ADDRESS',
            type: 'watch',
        }

        expect(mockSetAccounts).toHaveBeenCalledWith([expectedAccount])
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: expectedAccount,
        })
    })

    it('handleWatchAccount appends to existing accounts', () => {
        const existingAccount = {
            id: 'existing',
            address: 'OTHER_ADDRESS',
            type: 'watch',
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
            },
        ])
    })

    it('resolves NFD name to address when input contains a dot', () => {
        vi.mocked(useNfdSearch).mockReturnValue({
            results: [
                {
                    name: 'alice.algo',
                    address: 'VALID_ALGORAND_ADDRESS',
                    service: { name: 'NFD', logo: '' },
                },
            ],
            isLoading: false,
            isError: false,
            error: null,
        })

        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('alice.algo')
        })

        expect(result.current.isNfdResolved).toBe(true)
        expect(result.current.nfdName).toBe('alice.algo')
        expect(result.current.resolvedAddress).toBe('VALID_ALGORAND_ADDRESS')
        expect(result.current.isValidAddress).toBe(true)
    })

    it('does not resolve NFD when input has no dot', () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('alice')
        })

        expect(result.current.isNfdResolved).toBe(false)
        expect(result.current.nfdName).toBeUndefined()
    })

    it('shows resolving state during NFD lookup', () => {
        vi.mocked(useNfdSearch).mockReturnValue({
            results: [],
            isLoading: true,
            isError: false,
            error: null,
        })

        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('alice.algo')
        })

        expect(result.current.isNfdResolving).toBe(true)
    })
})
