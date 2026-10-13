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

const mockNavigate = vi.fn()
const mockSigningAccounts: { current: { id: string }[] } = { current: [] }

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

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAllAccounts: () => [],
        useSigningAccounts: () => mockSigningAccounts.current,
    }
})

import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import {
    algorandAccountAt,
    registerAlgorandRampAdapter,
} from '@test-utils/rampChainAdapter'

import {
    useAccountPickers,
    useCardPicker,
    useFundPicker,
    usePortfolioPicker,
    useSigningPicker,
} from '../useAccountPickers'

describe('useCardPicker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps the browsing list shape', () => {
        const { result } = renderHook(() => useCardPicker())
        const { result: portfolio } = renderHook(() => usePortfolioPicker())

        expect(result.current.showSearch).toBe(portfolio.current.showSearch)
        expect(result.current.showPeraCardActivation).toBe(
            portfolio.current.showPeraCardActivation,
        )
    })

    // The screen underneath shows the card, not the picked account, so it has to
    // move; naming AccountDetails matters because 'Home' resolves to the card.
    it('returns to the wallet account on selection', () => {
        const { result } = renderHook(() => useCardPicker())

        result.current.onSelected?.({ address: 'ADDR_A' } as never)

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: { screen: 'AccountDetails' },
        })
    })

    it('leaves the portfolio picker without navigation, since it is already there', () => {
        const { result } = renderHook(() => usePortfolioPicker())

        expect(result.current.onSelected).toBeUndefined()
    })
})

// The drawer looks a picker up by the kind a screen published and calls its
// `onSelected`; a kind missing from this record is a screen whose selection
// silently does nothing.
describe('useAccountPickers', () => {
    it('offers the card kind, and only that kind navigates', () => {
        const { result } = renderHook(() => useAccountPickers())

        expect(Object.keys(result.current).sort()).toEqual([
            'card',
            'fund',
            'portfolio',
            'select',
        ])
        expect(result.current.card.onSelected).toBeDefined()
        expect(result.current.portfolio.onSelected).toBeUndefined()
        expect(result.current.select.onSelected).toBeUndefined()
        expect(result.current.fund.onSelected).toBeUndefined()
    })
})

describe('useFundPicker', () => {
    const fundable = algorandAccountAt('ALGORAND_ADDRESS', 'fundable')
    const elsewhere: WalletAccount = {
        id: 'elsewhere',
        custody: { kind: 'local', seed: null },
        chains: { ethereum: { address: '0xADDRESS' } },
    }

    beforeEach(() => {
        useRemoteConfigStore.getState().resetState()
        registerAlgorandRampAdapter()
        mockSigningAccounts.current = [fundable, elsewhere]
    })

    it('offers only signing accounts on a chain with onramp', () => {
        const { result } = renderHook(() => useFundPicker())

        expect(result.current.accountFilter?.(fundable)).toBe(true)
        expect(result.current.accountFilter?.(elsewhere)).toBe(false)
    })

    it('leaves out an account whose chain has onramp off', () => {
        setCapabilityOverrides({ onramp: false })

        const { result } = renderHook(() => useFundPicker())

        expect(result.current.accountFilter?.(fundable)).toBe(false)
    })

    it('leaves out an account the wallet cannot sign for', () => {
        mockSigningAccounts.current = []

        const { result } = renderHook(() => useFundPicker())

        expect(result.current.accountFilter?.(fundable)).toBe(false)
    })
})

describe('useSigningPicker', () => {
    it('only lists the accounts useSigningAccounts returns', () => {
        mockSigningAccounts.current = [{ id: 'A' }]

        const { result } = renderHook(() => useSigningPicker())

        expect(result.current.accountFilter?.({ id: 'A' } as never)).toBe(true)
        expect(result.current.accountFilter?.({ id: 'B' } as never)).toBe(false)
    })
})
