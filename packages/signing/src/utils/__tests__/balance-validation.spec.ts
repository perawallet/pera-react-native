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

import { describe, test, expect } from 'vitest'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import {
    validateSignerBalances,
    type AccountOnChainState,
} from '../balance-validation'

const makeTx = (
    overrides: Partial<PeraDisplayableTransaction> = {},
): PeraDisplayableTransaction =>
    ({
        sender: 'ADDR1',
        fee: 1000n,
        ...overrides,
    }) as unknown as PeraDisplayableTransaction

const makeAccountState = (
    overrides: Partial<AccountOnChainState> = {},
): AccountOnChainState => ({
    address: 'ADDR1',
    amount: 1000000n,
    minBalance: 100000n,
    assets: [],
    ...overrides,
})

describe('validateSignerBalances', () => {
    const signableAddresses = new Set(['ADDR1', 'ADDR2'])

    test('returns valid for empty transactions', () => {
        const result = validateSignerBalances([], signableAddresses, new Map())
        expect(result.isValid).toBe(true)
        expect(result.errors).toEqual([])
    })

    test('validates sufficient ALGO for fees only', () => {
        const txs = [makeTx({ fee: 1000n })]
        const states = new Map([
            [
                'ADDR1',
                makeAccountState({ amount: 200000n, minBalance: 100000n }),
            ],
        ])

        const result = validateSignerBalances(txs, signableAddresses, states)
        expect(result.isValid).toBe(true)
        expect(result.errors).toEqual([])
    })

    test('detects insufficient ALGO (fee + payment + MBR)', () => {
        const txs = [
            makeTx({
                fee: 1000n,
                paymentTransaction: {
                    amount: 900000n,
                    receiver: 'RECEIVER',
                } as any,
            }),
        ]
        const states = new Map([
            [
                'ADDR1',
                makeAccountState({ amount: 500000n, minBalance: 100000n }),
            ],
        ])

        const result = validateSignerBalances(txs, signableAddresses, states)
        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toEqual({
            type: 'insufficient-algo',
            address: 'ADDR1',
            required: 1000n + 900000n + 100000n,
            available: 500000n,
        })
    })

    test('aggregates ALGO across multiple payments from same sender', () => {
        const txs = [
            makeTx({
                fee: 1000n,
                paymentTransaction: {
                    amount: 300000n,
                    receiver: 'RECEIVER1',
                } as any,
            }),
            makeTx({
                fee: 1000n,
                paymentTransaction: {
                    amount: 300000n,
                    receiver: 'RECEIVER2',
                } as any,
            }),
        ]
        const states = new Map([
            [
                'ADDR1',
                makeAccountState({ amount: 500000n, minBalance: 100000n }),
            ],
        ])

        const result = validateSignerBalances(txs, signableAddresses, states)
        expect(result.isValid).toBe(false)
        expect(result.errors[0]).toEqual({
            type: 'insufficient-algo',
            address: 'ADDR1',
            required: 2000n + 600000n + 100000n,
            available: 500000n,
        })
    })

    test('detects insufficient asset balance', () => {
        const txs = [
            makeTx({
                fee: 1000n,
                assetTransferTransaction: {
                    assetId: 42n,
                    amount: 500n,
                    receiver: 'RECEIVER',
                } as any,
            }),
        ]
        const states = new Map([
            [
                'ADDR1',
                makeAccountState({
                    assets: [{ assetId: 42n, amount: 100n }],
                }),
            ],
        ])

        const result = validateSignerBalances(txs, signableAddresses, states)
        expect(result.isValid).toBe(false)
        expect(result.errors).toEqual([
            {
                type: 'insufficient-asset',
                address: 'ADDR1',
                assetId: 42n,
                required: 500n,
                available: 100n,
            },
        ])
    })

    test('ignores transactions from non-signable addresses', () => {
        const txs = [
            makeTx({
                sender: 'NON_SIGNABLE',
                fee: 1000n,
                paymentTransaction: {
                    amount: 9999999n,
                    receiver: 'RECEIVER',
                } as any,
            }),
        ]
        const states = new Map([
            [
                'NON_SIGNABLE',
                makeAccountState({ address: 'NON_SIGNABLE', amount: 0n }),
            ],
        ])

        const result = validateSignerBalances(txs, signableAddresses, states)
        expect(result.isValid).toBe(true)
        expect(result.errors).toEqual([])
    })

    test('skips asset amount check for clawback transactions (signer pays fee only)', () => {
        const txs = [
            makeTx({
                fee: 1000n,
                assetTransferTransaction: {
                    assetId: 42n,
                    amount: 500n,
                    receiver: 'RECEIVER',
                    sender: 'CLAWBACK_TARGET', // sender set = clawback
                } as any,
            }),
        ]
        const states = new Map([
            [
                'ADDR1',
                makeAccountState({
                    assets: [], // no holdings of asset 42
                }),
            ],
        ])

        const result = validateSignerBalances(txs, signableAddresses, states)
        // Should be valid since clawback doesn't require signer to hold the asset
        expect(result.isValid).toBe(true)
        expect(result.errors).toEqual([])
    })

    test('handles multiple signers independently', () => {
        const txs = [
            makeTx({
                sender: 'ADDR1',
                fee: 1000n,
                paymentTransaction: {
                    amount: 800000n,
                    receiver: 'RECEIVER',
                } as any,
            }),
            makeTx({
                sender: 'ADDR2',
                fee: 1000n,
                paymentTransaction: {
                    amount: 800000n,
                    receiver: 'RECEIVER',
                } as any,
            }),
        ]
        const states = new Map([
            [
                'ADDR1',
                makeAccountState({
                    address: 'ADDR1',
                    amount: 1000000n,
                    minBalance: 100000n,
                }),
            ],
            [
                'ADDR2',
                makeAccountState({
                    address: 'ADDR2',
                    amount: 500000n,
                    minBalance: 100000n,
                }),
            ],
        ])

        const result = validateSignerBalances(txs, signableAddresses, states)
        expect(result.isValid).toBe(false)
        // Only ADDR2 should fail (800000 + 1000 + 100000 = 901000 > 500000)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].address).toBe('ADDR2')
    })

    test('boundary: balance exactly equals required is valid', () => {
        const txs = [
            makeTx({
                fee: 1000n,
                paymentTransaction: {
                    amount: 99000n,
                    receiver: 'RECEIVER',
                } as any,
            }),
        ]
        // required = 1000 + 99000 + 100000 = 200000
        const states = new Map([
            [
                'ADDR1',
                makeAccountState({ amount: 200000n, minBalance: 100000n }),
            ],
        ])

        const result = validateSignerBalances(txs, signableAddresses, states)
        expect(result.isValid).toBe(true)
        expect(result.errors).toEqual([])
    })

    test('missing account state treats as insufficient', () => {
        const txs = [makeTx({ fee: 1000n })]
        // No account state for ADDR1
        const states = new Map<string, AccountOnChainState>()

        const result = validateSignerBalances(txs, signableAddresses, states)
        expect(result.isValid).toBe(false)
        expect(result.errors[0]).toEqual({
            type: 'insufficient-algo',
            address: 'ADDR1',
            required: 1000n, // fee + 0 payments + 0 minBalance
            available: 0n,
        })
    })
})
