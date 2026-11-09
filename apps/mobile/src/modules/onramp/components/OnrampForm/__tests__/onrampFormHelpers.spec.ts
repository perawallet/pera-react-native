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
import type { RampPair, RampToken } from '@perawallet/wallet-core-onramp'
import {
    buildPendingXoHistoryItem,
    getExcludedPaymentMethodIds,
    isMeldPair,
} from '../onrampFormHelpers'

const token = (kind: RampToken['kind'], id: string): RampToken => ({
    id,
    kind,
    symbol: id,
    name: id,
    fractionDecimals: 6,
    logo: null,
    network: { name: '', logo: null },
})

const pairOf = (kind: RampToken['kind']): RampPair => ({
    id: `${kind}|dest`,
    sourceToken: token(kind, kind),
    destinationToken: token('token', 'dest'),
})

describe('isMeldPair', () => {
    it('is true for a fiat source and false for a deposit source', () => {
        expect(isMeldPair(pairOf('fiat'))).toBe(true)
        expect(isMeldPair(pairOf('deposit'))).toBe(false)
    })

    it('is false without a pair', () => {
        expect(isMeldPair(null)).toBe(false)
    })
})

describe('getExcludedPaymentMethodIds', () => {
    it('excludes the other platform wallet on each platform', () => {
        expect(getExcludedPaymentMethodIds('ios')).toEqual(['GOOGLE_PAY'])
        expect(getExcludedPaymentMethodIds('android')).toEqual(['APPLE_PAY'])
        expect(getExcludedPaymentMethodIds('web')).toEqual([])
    })
})

describe('buildPendingXoHistoryItem', () => {
    it('shapes a placed deposit order as a pending XO history item with its pay-in details', () => {
        const pair = pairOf('deposit')

        const item = buildPendingXoHistoryItem(
            {
                kind: 'xo',
                orderId: 'order-1',
                deposit: { address: 'PAYIN', memo: '42' },
            },
            pair,
            new Decimal('0.5'),
            new Decimal(950),
            'RECEIVER',
            '2026-01-01T00:00:00.000Z',
        )

        expect(item).toMatchObject({
            id: 'order-1',
            kind: 'xo',
            status: 'pending',
            pair,
            toAddress: 'RECEIVER',
            payInAddress: 'PAYIN',
            payInAddressTag: '42',
        })
    })

    it('leaves the tag out when the deposit has no memo', () => {
        const item = buildPendingXoHistoryItem(
            {
                kind: 'xo',
                orderId: 'order-1',
                deposit: { address: 'PAYIN', memo: null },
            },
            pairOf('deposit'),
            new Decimal(1),
            null,
            'RECEIVER',
            '2026-01-01T00:00:00.000Z',
        )

        expect(item.payInAddressTag).toBeUndefined()
        expect(item.destinationAmount).toBeNull()
    })
})
