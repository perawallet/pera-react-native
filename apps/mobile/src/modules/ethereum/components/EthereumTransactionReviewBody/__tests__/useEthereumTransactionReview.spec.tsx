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

import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { describe, expect, it, vi } from 'vitest'
import type { EthereumTransactionPresentation } from '../../../hooks/useEthereumTransactionPresentation'
import { useEthereumSimulationSection } from '../../EthereumSimulationSection'
import { useEthereumTransactionReview } from '../useEthereumTransactionReview'

vi.mock('../../EthereumSimulationSection', () => ({
    useEthereumSimulationSection: vi.fn(),
}))

vi.mock('@modules/signing', () => ({
    PredictedFailureMessage: () => null,
}))

vi.mock('../EthereumHighFeeMessage', () => ({
    EthereumHighFeeMessage: () => null,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: object) =>
            params ? `${key}|${JSON.stringify(params)}` : key,
    }),
}))

const presentation = {
    scope: { chainId: 'ethereum', networkId: 'sepolia' },
    hasHighFee: true,
    reviewFee: { maxAmount: new Decimal(1) },
    isTransfer: false,
    standardCall: undefined,
    contractAction: undefined,
    view: { action: undefined },
} as unknown as EthereumTransactionPresentation

const review = (verifiedOrigin?: string) =>
    renderHook(() =>
        useEthereumTransactionReview({ presentation, verifiedOrigin }),
    ).result.current

describe('useEthereumTransactionReview', () => {
    it('makes only the predicted failure high-risk, and the high fee and notices advisory', () => {
        vi.mocked(useEthereumSimulationSection).mockReturnValue({
            status: 'reverted',
            reason: null,
        })

        const { warningItems } = review()

        expect(
            warningItems.map(({ id, isHighRisk }) => [id, isHighRisk]),
        ).toEqual([
            ['predicted_failure_warning', true],
            ['ethereum_high_fee_warning', false],
            ['ethereum_contract_call_warning', false],
        ])
    })

    it('names the requesting host in the unchecked-call notice and the high-fee message', () => {
        vi.mocked(useEthereumSimulationSection).mockReturnValue({
            status: 'hidden',
        })

        const { warningItems } = review('https://app.uniswap.org/swap')

        const byId = (id: string) => warningItems.find(item => item.id === id)
        expect(byId('ethereum_contract_call_warning')?.message).toBe(
            'transactions.contract_call.unchecked_warning|{"domain":"app.uniswap.org"}',
        )
        expect(byId('ethereum_high_fee_warning')?.message).toMatchObject({
            props: {
                maxFee: presentation.reviewFee?.maxAmount,
                requesterHost: 'app.uniswap.org',
            },
        })
    })

    it('uses the no-source notice when nothing observed who asked', () => {
        vi.mocked(useEthereumSimulationSection).mockReturnValue({
            status: 'hidden',
        })

        const { warningItems } = review()

        expect(
            warningItems.find(
                item => item.id === 'ethereum_contract_call_warning',
            )?.message,
        ).toBe('transactions.contract_call.unchecked_warning_no_source')
    })

    it('gives an unavailable simulation an advisory item', () => {
        vi.mocked(useEthereumSimulationSection).mockReturnValue({
            status: 'unavailable',
        })

        const { warningItems } = review()

        expect(warningItems.at(-1)).toMatchObject({
            id: 'ethereum_simulation_unavailable',
            isHighRisk: false,
        })
    })

    it('hands back the simulation it ran once', () => {
        const state = { status: 'hidden' } as const
        vi.mocked(useEthereumSimulationSection).mockReturnValue(state)

        expect(review().simulation).toBe(state)
    })
})
