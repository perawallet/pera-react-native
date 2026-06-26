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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

import { useDepositToCardMutation } from '../useDepositToCardMutation'
import {
    setCardFundingProvider,
    resetCardFundingProvider,
} from '../../api/funding'
import {
    CardFundingUnavailableError,
    type CardFundingProvider,
    type FundingResult,
} from '../../models'
import { useCardStore } from '../../store'

let queryClient: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

describe('useDepositToCardMutation', () => {
    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { mutations: { retry: false } },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'mainnet' })
        useCardStore.getState().resetState()
        resetCardFundingProvider()
    })
    afterEach(() => resetCardFundingProvider())

    it('reports funding unavailable and rejects with the typed error by default', async () => {
        const { result } = renderHook(() => useDepositToCardMutation(), {
            wrapper,
        })

        expect(result.current.isFundingAvailable).toBe(false)

        result.current.mutate({
            sourceAsset: 'USDC',
            sourceAmount: new Decimal(5),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBeInstanceOf(CardFundingUnavailableError)
    })

    it('runs getQuote → buildDelegation → submitFunding when a provider is available', async () => {
        const calls: string[] = []
        const expected: FundingResult = {
            delegationId: 'd1',
            status: 'PENDING',
        }
        const provider: CardFundingProvider = {
            isAvailable: () => true,
            getQuote: async () => {
                calls.push('quote')
                return null
            },
            buildDelegation: async () => {
                calls.push('build')
                return { delegationId: 'd1' }
            },
            submitFunding: async () => {
                calls.push('submit')
                return expected
            },
        }
        setCardFundingProvider(provider)

        const { result } = renderHook(() => useDepositToCardMutation(), {
            wrapper,
        })

        expect(result.current.isFundingAvailable).toBe(true)

        result.current.mutate({
            sourceAsset: 'USDC',
            sourceAmount: new Decimal(5),
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(calls).toEqual(['quote', 'build', 'submit'])
        expect(result.current.data).toEqual(expected)
    })
})
