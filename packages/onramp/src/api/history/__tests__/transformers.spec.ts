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

import {
    ACCOUNT,
    FIAT_ID,
    STABLE_ID,
    coinAsset,
    historyItem,
} from '../../../__tests__/routerFixtures'
import { rampHistoryItemSchema } from '../schema'
import { isFundHistoryItem, transformRampHistoryItem } from '../transformers'

const transform = (overrides: Parameters<typeof historyItem>[0] = {}) =>
    transformRampHistoryItem(
        rampHistoryItemSchema.parse(historyItem(overrides)),
    )

describe('transformRampHistoryItem', () => {
    it('maps a provider checkout order', () => {
        const item = transform()

        expect(item).toMatchObject({
            id: 'order-1',
            kind: 'meld',
            status: 'completed',
            creationDatetime: '2025-06-01T10:00:00Z',
            provider: 'BANXA',
            toAddress: ACCOUNT,
        })
        expect(item.pair.sourceToken.id).toBe(FIAT_ID)
        expect(item.pair.destinationToken.id).toBe(STABLE_ID)
        expect(item.sourceAmount?.toString()).toBe('600')
    })

    it('maps an external deposit order to XO', () => {
        const item = transform({
            funding_method: 'external_deposit',
            source_asset: coinAsset(),
            source_amount: '50000000',
        })

        expect(item.kind).toBe('xo')
        expect(item.sourceAmount?.toString()).toBe('0.5')
    })

    it('prefers the received amount over the expected one', () => {
        const expected = transform()
        const received = transform({
            destination_amount_received: '990000000',
        })

        expect(expected.destinationAmount?.toString()).toBe('999.5')
        expect(received.destinationAmount?.toString()).toBe('990')
    })

    it('renders a legacy row of nulls as a placeholder pair with no amounts', () => {
        const item = transform({
            provider: null,
            funding_method: null,
            destination_account: null,
            source_asset: null,
            destination_asset: null,
            source_amount: null,
            destination_amount_expected: null,
        })

        expect(item.kind).toBeNull()
        expect(item.provider).toBe('')
        expect(item.sourceAmount).toBeNull()
        expect(item.destinationAmount).toBeNull()
        expect(item.toAddress).toBeUndefined()
        expect(item.pair.sourceToken).toMatchObject({
            id: '',
            kind: 'token',
            symbol: '',
            fractionDecimals: 0,
        })
    })

    it('has no amount for an asset it does not know the decimals of', () => {
        const item = transform({ destination_asset: null })

        expect(item.destinationAmount).toBeNull()
        expect(item.sourceAmount?.toString()).toBe('600')
    })

    it('has no amount for an asset that gives no decimals', () => {
        const item = transform({
            destination_asset: { asset_id: STABLE_ID },
        })

        expect(item.destinationAmount).toBeNull()
    })

    it.each(['expired', 'refunded'] as const)('keeps a %s order', status => {
        expect(transform({ status }).status).toBe(status)
    })
})

describe('isFundHistoryItem', () => {
    it('drops a Swap order and keeps every other, including one with no funding method', () => {
        const parse = (funding_method: string | null) =>
            rampHistoryItemSchema.parse(historyItem({ funding_method }))

        expect(isFundHistoryItem(parse('wallet_transaction'))).toBe(false)
        expect(isFundHistoryItem(parse('provider_checkout'))).toBe(true)
        expect(isFundHistoryItem(parse('external_deposit'))).toBe(true)
        expect(isFundHistoryItem(parse(null))).toBe(true)
    })
})
