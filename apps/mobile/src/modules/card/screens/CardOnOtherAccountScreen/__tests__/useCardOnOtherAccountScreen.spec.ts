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

import { renderHook, act } from '@test-utils/render'
import { waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useCardOnOtherAccountScreen } from '../useCardOnOtherAccountScreen'

const WALLET_ADDRESS = 'WALLETADDRESS'

let mockHasSession = true
let mockOwnerAddress: string | null = null
let mockIsRestorePending = false
let mockIsFocused = true
let mockIsScreenFocused = true
const mockRestore = vi.fn()
const mockSetFundingSource = vi.fn()

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        hasCardSession: () => mockHasSession,
        useCardOwnerAddressQuery: () => ({
            ownerAddress: mockOwnerAddress,
            isLoading: false,
        }),
        useRestoreEscrowCardMutation: () => ({
            mutateAsync: mockRestore,
            isPending: mockIsRestorePending,
        }),
        setCardFundingSourceAddress: (address: unknown) =>
            mockSetFundingSource(address),
    }
})

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-accounts')
    >('@perawallet/wallet-core-accounts')
    return {
        ...actual,
        useAllAccounts: () =>
            [
                {
                    id: 'account-1',
                    custody: { kind: 'local', seed: null },
                    chains: { algorand: { address: WALLET_ADDRESS } },
                },
            ] as unknown as WalletAccount[],
    }
})

vi.mock('../../../hooks/useCardScope', () => ({
    useCardScope: () => ({ chainId: 'algorand', networkId: 'testnet' }),
}))

type BeforeRemoveEvent = {
    data: { action: { type: string } }
    preventDefault: () => void
}
let mockBeforeRemove: ((event: BeforeRemoveEvent) => void) | null = null
vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useIsFocused: () => mockIsFocused,
        useNavigation: () => ({
            addListener: (
                _event: string,
                callback: (event: BeforeRemoveEvent) => void,
            ) => {
                mockBeforeRemove = callback
                return () => {
                    mockBeforeRemove = null
                }
            },
        }),
    }
})

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        isFocused: () => mockIsScreenFocused,
    }),
}))

const mockInfoToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ infoToast: mockInfoToast }),
}))

const mockShowCardError = vi.fn()
const mockLogout = vi.fn()
const mockOpenSupport = vi.fn()
vi.mock('@modules/card/hooks', () => ({
    useCardErrorToast: () => mockShowCardError,
    useCardOnboardingLogout: () => ({ handleLogout: mockLogout }),
    useOpenCardSupport: () => mockOpenSupport,
}))

const renderSubject = () => renderHook(() => useCardOnOtherAccountScreen())

describe('useCardOnOtherAccountScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockHasSession = true
        mockOwnerAddress = null
        mockIsRestorePending = false
        mockIsFocused = true
        mockIsScreenFocused = true
        mockBeforeRemove = null
        mockRestore.mockResolvedValue(null)
    })

    it('looks for the card in this wallet on arrival and drops the local pick', async () => {
        renderSubject()

        await waitFor(() =>
            expect(mockRestore).toHaveBeenCalledWith([WALLET_ADDRESS]),
        )
        expect(mockSetFundingSource).toHaveBeenCalledWith(null)
        expect(mockInfoToast).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('names the account the card is bound to once it is known', () => {
        mockOwnerAddress = 'OWNERADDRESS'

        const { result } = renderSubject()

        expect(result.current.ownerAddress).toBe('OWNERADDRESS')
    })

    it('opens the card once the wallet holds the bound account', async () => {
        mockRestore.mockResolvedValue('CARDADDRESS')

        renderSubject()

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Home',
                params: { screen: 'PeraCardAccount' },
            }),
        )
    })

    it('stays put when the user logged out while the lookup ran', async () => {
        mockHasSession = false
        mockRestore.mockResolvedValue('CARDADDRESS')

        renderSubject()

        await waitFor(() => expect(mockRestore).toHaveBeenCalledTimes(1))
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('stays put when the user left the screen while the lookup ran', async () => {
        mockIsScreenFocused = false
        mockRestore.mockResolvedValue('CARDADDRESS')

        renderSubject()

        await waitFor(() => expect(mockRestore).toHaveBeenCalledTimes(1))
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('looks once per visit, and again when the user comes back', async () => {
        const { rerender } = renderSubject()
        await waitFor(() => expect(mockRestore).toHaveBeenCalledTimes(1))

        rerender()
        expect(mockRestore).toHaveBeenCalledTimes(1)

        mockIsFocused = false
        rerender()
        mockIsFocused = true
        rerender()

        await waitFor(() => expect(mockRestore).toHaveBeenCalledTimes(2))
    })

    it('tells the user when checking again still finds no bound account', async () => {
        const { result } = renderSubject()
        await waitFor(() => expect(mockRestore).toHaveBeenCalledTimes(1))

        act(() => result.current.handleCheckAgain())

        await waitFor(() => expect(mockInfoToast).toHaveBeenCalledTimes(1))
        expect(mockRestore).toHaveBeenCalledTimes(2)
        expect(mockShowCardError).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('reports a failed check as an error rather than a missing account', async () => {
        const failure = new Error('network')
        const { result } = renderSubject()
        await waitFor(() => expect(mockRestore).toHaveBeenCalledTimes(1))
        mockRestore.mockRejectedValueOnce(failure)

        act(() => result.current.handleCheckAgain())

        await waitFor(() =>
            expect(mockShowCardError).toHaveBeenCalledWith(failure),
        )
        expect(mockInfoToast).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('keeps a failed lookup on arrival silent', async () => {
        mockRestore.mockRejectedValue(new Error('network'))

        renderSubject()

        await waitFor(() => expect(mockRestore).toHaveBeenCalledTimes(1))
        expect(mockShowCardError).not.toHaveBeenCalled()
        expect(mockInfoToast).not.toHaveBeenCalled()
    })

    it('ignores check again while a lookup is in flight', () => {
        mockIsRestorePending = true
        const { result } = renderSubject()
        mockRestore.mockClear()

        act(() => result.current.handleCheckAgain())

        expect(mockRestore).not.toHaveBeenCalled()
        expect(result.current.isCheckingAgain).toBe(true)
    })

    it('sends a back action to the wallet home instead of the checklist', () => {
        renderSubject()
        const preventDefault = vi.fn()

        mockBeforeRemove?.({
            data: { action: { type: 'GO_BACK' } },
            preventDefault,
        })

        expect(preventDefault).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Home' })
    })

    it('lets logout leave without redirecting', () => {
        const { result } = renderSubject()
        const preventDefault = vi.fn()

        result.current.handleLogout()
        mockBeforeRemove?.({
            data: { action: { type: 'NAVIGATE' } },
            preventDefault,
        })

        expect(mockLogout).toHaveBeenCalledTimes(1)
        expect(preventDefault).not.toHaveBeenCalled()
    })
})
