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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import type { EthereumTransactionPresentation } from '../../../hooks/useEthereumTransactionPresentation'
import type { EthereumSimulationSectionState } from '../../EthereumSimulationSection'
import { ethereumReviewWarningsOf } from '../ethereumReviewWarnings'

const MAX_FEE = new Decimal('458000000000000')

const presentationOf = (
    overrides: Partial<EthereumTransactionPresentation> = {},
) =>
    ({
        hasHighFee: false,
        reviewFee: { maxAmount: MAX_FEE },
        isTransfer: false,
        standardCall: undefined,
        contractAction: undefined,
        view: { action: undefined },
        ...overrides,
    }) as unknown as EthereumTransactionPresentation

const simulationOf = (
    state: EthereumSimulationSectionState = { status: 'hidden' },
) => state

const kindsOf = (warnings: { kind: string }[]) => warnings.map(w => w.kind)

describe('ethereumReviewWarningsOf', () => {
    it('warns of an unchecked call when nothing explains the call', () => {
        const warnings = ethereumReviewWarningsOf({
            presentation: presentationOf(),
            simulation: simulationOf(),
        })

        expect(kindsOf(warnings)).toEqual(['unchecked-call'])
    })

    it('does not warn of an unchecked call on a transfer or a standard call', () => {
        const transfer = ethereumReviewWarningsOf({
            presentation: presentationOf({ isTransfer: true }),
            simulation: simulationOf(),
        })
        const approval = ethereumReviewWarningsOf({
            presentation: presentationOf({
                standardCall: {},
            } as unknown as Partial<EthereumTransactionPresentation>),
            simulation: simulationOf(),
        })

        expect(transfer).toEqual([])
        expect(approval).toEqual([])
    })

    it('flags a high fee with the max fee the fee rows show', () => {
        const warnings = ethereumReviewWarningsOf({
            presentation: presentationOf({
                hasHighFee: true,
                isTransfer: true,
            }),
            simulation: simulationOf(),
        })

        expect(warnings).toEqual([
            { kind: 'high-fee', maxFee: MAX_FEE, requesterHost: undefined },
        ])
    })

    it('does not flag a high fee without a fee to show', () => {
        const warnings = ethereumReviewWarningsOf({
            presentation: presentationOf({
                hasHighFee: true,
                isTransfer: true,
                reviewFee: undefined,
            } as unknown as Partial<EthereumTransactionPresentation>),
            simulation: simulationOf(),
        })

        expect(warnings).toEqual([])
    })

    it('names the observed origin ahead of the attested one', () => {
        const source = {
            verification: { verifiedOrigin: 'https://attested.example' },
        } as unknown as SignRequestSource

        const [warning] = ethereumReviewWarningsOf({
            presentation: presentationOf({
                hasHighFee: true,
                isTransfer: true,
            }),
            simulation: simulationOf(),
            source,
            verifiedOrigin: 'https://observed.example',
        })

        expect(warning).toMatchObject({ requesterHost: 'observed.example' })
    })

    it('orders a predicted failure, then the fee and the unchecked call, leaving an unavailable simulation to the changes card', () => {
        const reverted = ethereumReviewWarningsOf({
            presentation: presentationOf({ hasHighFee: true }),
            simulation: simulationOf({ status: 'reverted', reason: 'EXPIRED' }),
        })
        const unavailable = ethereumReviewWarningsOf({
            presentation: presentationOf({ hasHighFee: true }),
            simulation: simulationOf({ status: 'unavailable' }),
        })

        expect(kindsOf(reverted)).toEqual([
            'predicted-failure',
            'high-fee',
            'unchecked-call',
        ])
        expect(reverted[0]).toEqual({
            kind: 'predicted-failure',
            reason: 'EXPIRED',
        })
        expect(kindsOf(unavailable)).toEqual(['high-fee', 'unchecked-call'])
    })

    it('cautions when assets leave and nothing, not even a permission, comes back', () => {
        const spend = [{ assetId: 'native' }] as never
        const nothingBack = ethereumReviewWarningsOf({
            presentation: presentationOf({ isTransfer: true }),
            simulation: simulationOf({
                status: 'success',
                spend,
                receive: [],
                approvals: [],
            }),
        })
        const swap = ethereumReviewWarningsOf({
            presentation: presentationOf({ isTransfer: true }),
            simulation: simulationOf({
                status: 'success',
                spend,
                receive: spend,
                approvals: [],
            }),
        })

        expect(kindsOf(nothingBack)).toEqual(['nothing-back'])
        expect(swap).toEqual([])
    })
})
