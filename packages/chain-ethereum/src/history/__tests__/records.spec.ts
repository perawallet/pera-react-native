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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { evmHistoryItem } from '../api/msw-handlers'
import {
    evmHistoryItemSchema,
    type EvmHistoryItemResponse,
} from '../api/schema'
import { toEvmHistoryRecords } from '../records'
import { ETHEREUM } from '../../__tests__/evm-chains'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ME = '0x00000000000000000000000000000000000000aa'
const PEER = '0x00000000000000000000000000000000000000bb'

const send = (overrides: Partial<EvmHistoryItemResponse> = {}) =>
    evmHistoryItemSchema.parse(
        evmHistoryItem({
            from: ME,
            to: PEER,
            value: '1000',
            fee: '21000',
            balance_impacts: [
                { asset_id: 'eip155:1/slip44:60', amount: '-22000' },
            ],
            ...overrides,
        }),
    )

const chainDataOf = (overrides: Partial<EvmHistoryItemResponse>) =>
    toEvmHistoryRecords(
        send(overrides),
        ME,
        SCOPE,
        ETHEREUM,
        false,
        new Set(),
        false,
    )[0]?.chainData

describe("a history record's gas", () => {
    it('carries every gas field the backend gives', () => {
        expect(
            chainDataOf({
                nonce: 7,
                gas_limit: '21000',
                gas_used: '21000',
                gas_price: '1000000000',
            }),
        ).toEqual({
            family: 'evm',
            gas: {
                nonce: 7,
                gasLimit: 21_000n,
                gasUsed: 21_000n,
                gasPrice: new Decimal('1000000000'),
            },
        })
    })

    it('carries only the fields given, leaving out a null one', () => {
        expect(
            chainDataOf({ nonce: 0, gas_used: '21000', gas_limit: null }),
        ).toEqual({
            family: 'evm',
            gas: { nonce: 0, gasUsed: 21_000n },
        })
    })

    it('carries no gas from a backend that sends none', () => {
        expect(chainDataOf({})).toEqual({ family: 'evm' })
    })

    it('drops a malformed gas field and keeps the row', () => {
        const item = send({
            nonce: -1,
            gas_limit: 'abc' as string,
            gas_used: '21000',
        })

        expect(item.nonce).toBeUndefined()
        expect(item.gas_limit).toBeUndefined()
        expect(item.gas_used).toBe('21000')
        expect(item.hash).toBe(`0x${'1'.padStart(64, '0')}`)
    })
})

describe('a cross-chain swap deposit', () => {
    it('places the payout asset on its own network', () => {
        const [record] = toEvmHistoryRecords(
            send({
                swap: {
                    role: 'deposit',
                    order: {
                        order_id: 'o1',
                        provider: 'xo',
                        status: 'completed',
                        source_asset: {
                            asset_id: 'eip155:1/slip44:60',
                            unit_name: 'ETH',
                            fraction_decimals: 18,
                        },
                        destination_asset: {
                            asset_id: 'eip155:8453/slip44:60',
                            unit_name: 'ETH',
                            fraction_decimals: 18,
                        },
                        source_amount: '1000',
                        destination_amount_expected: '900',
                        destination_amount_received: '950',
                    },
                },
            }),
            ME,
            SCOPE,
            ETHEREUM,
            false,
            new Set(),
            false,
        )

        expect(
            record?.summary.balanceChanges?.map(change => [
                change.assetRef.chainId,
                change.value.toString(),
            ]),
        ).toEqual([
            ['ethereum', '-1000'],
            ['base', '950'],
        ])
    })
})
