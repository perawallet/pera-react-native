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

import { describe, expect, test, vi } from 'vitest'
import type { SwapDistinctPairItem } from '../../models'
import { pairsPaidBy } from '../pairsPaidBy'

const ALGO = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETH = { chainId: 'ethereum', networkId: 'mainnet' } as const

const assetOn = (scope: typeof ALGO | typeof ETH, assetId: string) => ({
    assetId,
    ref: { ...scope, assetId },
})

const pair = (
    payer: { scope: typeof ALGO | typeof ETH; address: string },
    legs: [typeof ALGO | typeof ETH, typeof ALGO | typeof ETH] = [
        payer.scope,
        payer.scope,
    ],
) =>
    ({
        assetIn: assetOn(legs[0], 'in'),
        assetOut: assetOn(legs[1], 'out'),
        sourceAccount: payer,
        swapDatetime: '2026-10-01T00:00:00Z',
        pairKey: `${payer.address}|${legs[0].chainId}|${legs[1].chainId}`,
    }) as unknown as SwapDistinctPairItem

const PAYERS = [
    { scope: ALGO, address: 'MAIN', accountId: 'main', isOnDevice: true },
    { scope: ETH, address: '0xAbC', accountId: 'other', isOnDevice: true },
]
const canPayAnywhere = () => true
const canBePaidAnywhere = () => true

describe('swaps/pairsPaidBy', () => {
    test('tags each pair with its payer, matching an EVM address in any casing', () => {
        const paid = pair({ scope: ETH, address: '0xabc' })

        expect(
            pairsPaidBy([paid], PAYERS, canPayAnywhere, canBePaidAnywhere),
        ).toEqual([{ ...paid, accountId: 'other' }])
    })

    test("keeps a cross-chain pair whose destination network is a payer's, tagged with the source payer", () => {
        const crossChain = pair({ scope: ALGO, address: 'MAIN' }, [ALGO, ETH])

        expect(
            pairsPaidBy(
                [crossChain],
                PAYERS,
                canPayAnywhere,
                canBePaidAnywhere,
            ),
        ).toEqual([{ ...crossChain, accountId: 'main' }])
    })

    test('leaves out a cross-chain pair into a network no payer is on', () => {
        const sepolia = { chainId: 'ethereum', networkId: 'sepolia' } as const
        const intoSepolia = pair({ scope: ALGO, address: 'MAIN' }, [
            ALGO,
            sepolia as unknown as typeof ETH,
        ])

        expect(
            pairsPaidBy(
                [intoSepolia],
                PAYERS,
                canPayAnywhere,
                canBePaidAnywhere,
            ),
        ).toEqual([])
    })

    test("leaves out a pair whose source leg is off the payer's network", () => {
        const wrongSource = pair({ scope: ALGO, address: 'MAIN' }, [ETH, ALGO])

        expect(
            pairsPaidBy(
                [wrongSource],
                PAYERS,
                canPayAnywhere,
                canBePaidAnywhere,
            ),
        ).toEqual([])
    })

    test('keeps a same-chain Base pair paid by an EVM payer', () => {
        const BASE = { chainId: 'base', networkId: 'mainnet' } as const
        const payers = [
            ...PAYERS,
            {
                scope: BASE,
                address: '0xBase',
                accountId: 'evm',
                isOnDevice: true,
            },
        ]
        const onBase = pair({
            scope: BASE as unknown as typeof ETH,
            address: '0xbase',
        })

        expect(
            pairsPaidBy([onBase], payers, canPayAnywhere, canBePaidAnywhere),
        ).toEqual([{ ...onBase, accountId: 'evm' }])
    })

    test('leaves out an unknown payer and a pair with no payer', () => {
        const stranger = pair({ scope: ALGO, address: 'STRANGER' })
        const unpaid = {
            ...pair({ scope: ALGO, address: 'MAIN' }),
            sourceAccount: null,
        }

        expect(
            pairsPaidBy(
                [stranger, unpaid],
                PAYERS,
                canPayAnywhere,
                canBePaidAnywhere,
            ),
        ).toEqual([])
    })

    test('leaves out a pair its payer can no longer pay on', () => {
        const paid = pair({ scope: ALGO, address: 'MAIN' })

        expect(
            pairsPaidBy([paid], PAYERS, () => false, canBePaidAnywhere),
        ).toEqual([])
    })

    test("leaves out a cross-chain pair whose payer can't be paid on the destination chain", () => {
        const crossChain = pair({ scope: ALGO, address: 'MAIN' }, [ALGO, ETH])
        const canBePaidOn = vi.fn(() => false)

        expect(
            pairsPaidBy([crossChain], PAYERS, canPayAnywhere, canBePaidOn),
        ).toEqual([])
        expect(canBePaidOn).toHaveBeenCalledWith('main', 'ethereum')
    })

    test('keeps a same-chain pair without asking where its payer can be paid', () => {
        const paid = pair({ scope: ALGO, address: 'MAIN' })
        const canBePaidOn = vi.fn(() => false)

        expect(
            pairsPaidBy([paid], PAYERS, canPayAnywhere, canBePaidOn),
        ).toEqual([{ ...paid, accountId: 'main' }])
        expect(canBePaidOn).not.toHaveBeenCalled()
    })
})
