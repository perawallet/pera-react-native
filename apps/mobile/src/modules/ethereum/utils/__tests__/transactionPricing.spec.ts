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
import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import type { EthereumTransactionView } from '@perawallet/wallet-core-chain-ethereum'
import {
    mergePricing,
    recordPricingOf,
    viewPricingOf,
} from '../transactionPricing'

const base = {
    kind: 'transfer',
    from: '0x0000000000000000000000000000000000000001',
    value: new Decimal(0),
    data: '0x',
} as const

const viewOf = (extra: object) =>
    ({ ...base, ...extra }) as unknown as EthereumTransactionView

const recordOf = (chainData: TransactionRecord['chainData']) =>
    ({ chainData }) as TransactionRecord

describe('viewPricingOf', () => {
    it('reads what a priced view’s signature commits to', () => {
        const fee = {
            maxFeePerGas: new Decimal(30),
            maxPriorityFeePerGas: new Decimal(2),
            maxFee: new Decimal(630_000),
        }

        expect(viewPricingOf(viewOf({ nonce: 4, gas: 21_000n, fee }))).toEqual({
            nonce: 4,
            gasLimit: 21_000n,
            maxFeePerGas: fee.maxFeePerGas,
            maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
        })
    })

    it('reads what the node reports for a mined view, renaming its gas to the limit', () => {
        const gasPrice = new Decimal(20)
        const view = viewOf({
            isMined: true,
            onChain: { nonce: 7, gas: 50_000n, gasPrice },
        })

        expect(viewPricingOf(view)).toEqual({
            nonce: 7,
            gasLimit: 50_000n,
            gasPrice,
        })
    })

    it.each([
        ['a mined view the node wasn’t read for', { isMined: true }],
        ['a preview', { isPreview: true }],
    ])('has none for %s', (_label, extra) => {
        expect(viewPricingOf(viewOf(extra))).toBeUndefined()
    })
})

describe('recordPricingOf', () => {
    it('reads the gas the history gave an EVM record', () => {
        const gas = { nonce: 1, gasUsed: 21_000n }

        expect(recordPricingOf(recordOf({ family: 'evm', gas }))).toBe(gas)
    })

    it.each([
        ['an EVM record the history gave none', { family: 'evm' as const }],
        ['an Algorand record', { family: 'algorand' as const }],
    ])('has none for %s', (_label, chainData) => {
        expect(recordPricingOf(recordOf(chainData))).toBeUndefined()
    })
})

describe('mergePricing', () => {
    it('takes each part from the first source that has it', () => {
        const nodePrice = new Decimal(30)

        expect(
            mergePricing({ nonce: 3, maxFeePerGas: nodePrice }, undefined, {
                nonce: 9,
                gasUsed: 21_000n,
                gasPrice: new Decimal(20),
            }),
        ).toEqual({
            nonce: 3,
            maxFeePerGas: nodePrice,
            gasUsed: 21_000n,
            gasPrice: new Decimal(20),
        })
    })

    it('has none when no source has any part', () => {
        expect(
            mergePricing(undefined, {}, { nonce: undefined }),
        ).toBeUndefined()
    })
})
