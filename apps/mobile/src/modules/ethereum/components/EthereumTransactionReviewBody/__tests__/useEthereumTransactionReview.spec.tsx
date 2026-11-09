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
    useLanguage: () => ({ t: (key: string) => key }),
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

const review = () =>
    renderHook(() => useEthereumTransactionReview({ presentation })).result
        .current

describe('useEthereumTransactionReview', () => {
    it('makes the predicted failure and the high fee high-risk, and the notices advisory', () => {
        vi.mocked(useEthereumSimulationSection).mockReturnValue({
            status: 'reverted',
            reason: null,
        })

        const { warningItems } = review()

        expect(
            warningItems.map(({ id, isHighRisk }) => [id, isHighRisk]),
        ).toEqual([
            ['predicted_failure_warning', true],
            ['ethereum_high_fee_warning', true],
            ['ethereum_contract_call_warning', false],
        ])
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
