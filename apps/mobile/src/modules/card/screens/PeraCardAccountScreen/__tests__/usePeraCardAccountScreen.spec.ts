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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockState = vi.hoisted(() => ({
    connectedAddress: null as string | null,
    accounts: [] as Array<{ address: string; name?: string }>,
}))
const mockInfoToast = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return { ...actual, useAllAccounts: () => mockState.accounts }
})

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardStore: (
            selector: (state: {
                connectedFundingSourceAddress: string | null
            }) => unknown,
        ) =>
            selector({
                connectedFundingSourceAddress: mockState.connectedAddress,
            }),
        // The shell mounts the issuance watcher for its side effects only;
        // its own behavior is covered by the package hook's tests.
        useCardIssuance: () => ({ state: 'READY', retryOrder: vi.fn() }),
    }
})

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        infoToast: mockInfoToast,
        errorToast: vi.fn(),
        successToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        push: vi.fn(),
        replace: vi.fn(),
        goBack: vi.fn(),
        canGoBack: vi.fn(),
        reset: vi.fn(),
    }),
}))

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<object>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => key,
            i18n: { changeLanguage: vi.fn(), language: 'en' },
        }),
    }
})

import { usePeraCardAccountScreen } from '../usePeraCardAccountScreen'

describe('usePeraCardAccountScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockState.connectedAddress = null
        mockState.accounts = [{ address: 'ADDR_A', name: 'Main' }]
    })

    it('exposes the Pera Card title for the selection trigger', () => {
        const { result } = renderHook(() => usePeraCardAccountScreen())

        expect(result.current.cardDisplay.title).toBe(
            'peraCard.account.navigation_title',
        )
    })

    it('labels the linked account when the connected address matches', () => {
        mockState.connectedAddress = 'ADDR_A'

        const { result } = renderHook(() => usePeraCardAccountScreen())

        expect(result.current.cardDisplay.subtitle).toBe(
            'peraCard.account.linked_to',
        )
    })

    it('falls back when there is no connected account', () => {
        mockState.connectedAddress = null

        const { result } = renderHook(() => usePeraCardAccountScreen())

        expect(result.current.cardDisplay.subtitle).toBe(
            'peraCard.account.linked_to_fallback',
        )
    })

    it('falls back when the connected address is not among the accounts', () => {
        mockState.connectedAddress = 'ADDR_NOT_IN_LIST'

        const { result } = renderHook(() => usePeraCardAccountScreen())

        expect(result.current.cardDisplay.subtitle).toBe(
            'peraCard.account.linked_to_fallback',
        )
    })

    it('returns to the wallet home when a wallet account is selected', () => {
        const { result } = renderHook(() => usePeraCardAccountScreen())

        result.current.onSelectAccount()

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Home' })
    })

    it('header actions surface the coming-soon toast', () => {
        const { result } = renderHook(() => usePeraCardAccountScreen())

        result.current.onMore()
        result.current.onScan()
        result.current.onInbox()

        expect(mockInfoToast).toHaveBeenCalledTimes(3)
    })
})
