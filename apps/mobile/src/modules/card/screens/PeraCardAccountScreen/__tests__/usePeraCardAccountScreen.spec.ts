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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockState = vi.hoisted(() => ({
    connectedAddress: null as string | null,
    accounts: [] as Array<{ address: string; name?: string }>,
}))
const mockInfoToast = vi.fn()

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

    it('labels the linked account when the connected address matches', () => {
        mockState.connectedAddress = 'ADDR_A'

        const { result } = renderHook(() => usePeraCardAccountScreen())

        expect(result.current.linkedLabel).toBe('peraCard.account.linked_to')
    })

    it('falls back when there is no connected account', () => {
        mockState.connectedAddress = null

        const { result } = renderHook(() => usePeraCardAccountScreen())

        expect(result.current.linkedLabel).toBe(
            'peraCard.account.linked_to_fallback',
        )
    })

    it('falls back when the connected address is not among the accounts', () => {
        mockState.connectedAddress = 'ADDR_NOT_IN_LIST'

        const { result } = renderHook(() => usePeraCardAccountScreen())

        expect(result.current.linkedLabel).toBe(
            'peraCard.account.linked_to_fallback',
        )
    })

    it('header actions surface the coming-soon toast', () => {
        const { result } = renderHook(() => usePeraCardAccountScreen())

        result.current.onMore()
        result.current.onScan()
        result.current.onInbox()

        expect(mockInfoToast).toHaveBeenCalledTimes(3)
    })
})
