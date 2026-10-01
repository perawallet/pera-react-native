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
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { computeBalanceImpact } from '../balanceImpact'

const USER = 'USER_ADDRESS'
const OTHER = 'OTHER_ADDRESS'
const users = new Set([USER])

const payment = (
    overrides: Partial<{
        sender: string
        receiver: string
        amount: bigint
        fee: bigint
        closeRemainderTo: string
    }> = {},
): PeraDisplayableTransaction =>
    ({
        sender: overrides.sender ?? USER,
        fee: overrides.fee ?? 1000n,
        paymentTransaction: {
            amount: overrides.amount ?? 1_000_000n,
            receiver: overrides.receiver ?? OTHER,
            closeRemainderTo: overrides.closeRemainderTo,
        },
    }) as unknown as PeraDisplayableTransaction

const assetTransfer = (
    overrides: Partial<{
        sender: string
        assetSender: string
        receiver: string
        assetId: bigint
        amount: bigint
        fee: bigint
        closeTo: string
    }> = {},
): PeraDisplayableTransaction =>
    ({
        sender: overrides.sender ?? USER,
        fee: overrides.fee ?? 1000n,
        assetTransferTransaction: {
            assetId: overrides.assetId ?? 31566704n,
            amount: overrides.amount ?? 5_000_000n,
            receiver: overrides.receiver ?? OTHER,
            sender: overrides.assetSender,
            closeTo: overrides.closeTo,
        },
    }) as unknown as PeraDisplayableTransaction

const assetConfig = (
    overrides: Partial<{
        sender: string
        assetId: bigint
        name: string
        unitName: string
        total: bigint
        decimals: number
    }> = {},
): PeraDisplayableTransaction =>
    ({
        sender: overrides.sender ?? USER,
        fee: 1000n,
        assetConfigTransaction: {
            assetId: overrides.assetId ?? 0n,
            params: {
                name: overrides.name ?? 'Minted Asset',
                unitName: overrides.unitName ?? 'MINT',
                total: overrides.total ?? 1n,
                decimals: overrides.decimals ?? 0,
            },
        },
    }) as unknown as PeraDisplayableTransaction

describe('computeBalanceImpact', () => {
    it('records an outgoing ALGO payment as a negative delta and tracks the fee', () => {
        const { deltas, totalFeeMicroAlgos, hasCloseRemainder } =
            computeBalanceImpact([payment({ amount: 2_000_000n })], users)

        expect(deltas).toEqual([{ assetId: '0', amount: -2_000_000n }])
        expect(totalFeeMicroAlgos).toBe(1000n)
        expect(hasCloseRemainder).toBe(false)
    })

    it('records an incoming ALGO payment as positive and does not charge its fee to the user', () => {
        const { deltas, totalFeeMicroAlgos } = computeBalanceImpact(
            [payment({ sender: OTHER, receiver: USER, amount: 3_000_000n })],
            users,
        )

        expect(deltas).toEqual([{ assetId: '0', amount: 3_000_000n }])
        expect(totalFeeMicroAlgos).toBe(0n)
    })

    it('records an incoming asset transfer under its asset id', () => {
        const { deltas } = computeBalanceImpact(
            [
                assetTransfer({
                    sender: OTHER,
                    receiver: USER,
                    assetId: 999n,
                    amount: 42n,
                }),
            ],
            users,
        )

        expect(deltas).toEqual([{ assetId: '999', amount: 42n }])
    })

    it('nets a swap into one spend and one receive across the group', () => {
        const { deltas } = computeBalanceImpact(
            [
                payment({ amount: 10_000_000n }), // spend 10 ALGO
                assetTransfer({
                    sender: OTHER,
                    receiver: USER,
                    assetId: 31566704n,
                    amount: 25_000_000n,
                }), // receive USDC
            ],
            users,
        )

        expect(deltas).toContainEqual({ assetId: '0', amount: -10_000_000n })
        expect(deltas).toContainEqual({
            assetId: '31566704',
            amount: 25_000_000n,
        })
    })

    it('omits an internal transfer between the user’s own accounts but still counts the fee', () => {
        const { deltas, totalFeeMicroAlgos } = computeBalanceImpact(
            [payment({ sender: USER, receiver: USER, amount: 1_000_000n })],
            users,
        )

        expect(deltas).toEqual([])
        expect(totalFeeMicroAlgos).toBe(1000n)
    })

    it('debits the clawback target, not the transaction sender', () => {
        const { deltas } = computeBalanceImpact(
            [
                assetTransfer({
                    sender: OTHER, // clawback authority signs
                    assetSender: USER, // user is the one losing the asset
                    receiver: OTHER,
                    assetId: 7n,
                    amount: 100n,
                }),
            ],
            users,
        )

        expect(deltas).toEqual([{ assetId: '7', amount: -100n }])
    })

    it('flags a close-remainder sweep from the user and records the ALGO id', () => {
        const { hasCloseRemainder, closedAssetIds } = computeBalanceImpact(
            [payment({ amount: 0n, closeRemainderTo: OTHER })],
            users,
        )

        expect(hasCloseRemainder).toBe(true)
        expect(closedAssetIds).toEqual(['0'])
    })

    it('records the asset id of an asset-transfer close-to sweep', () => {
        const { hasCloseRemainder, closedAssetIds } = computeBalanceImpact(
            [
                assetTransfer({
                    sender: USER,
                    receiver: OTHER,
                    assetId: 42n,
                    amount: 1n,
                    closeTo: OTHER,
                }),
            ],
            users,
        )

        expect(hasCloseRemainder).toBe(true)
        expect(closedAssetIds).toEqual(['42'])
    })

    it('produces no delta for a zero-amount self opt-in', () => {
        const { deltas } = computeBalanceImpact(
            [
                assetTransfer({
                    sender: USER,
                    receiver: USER,
                    assetId: 55n,
                    amount: 0n,
                }),
            ],
            users,
        )

        expect(deltas).toEqual([])
    })

    it('nets multiple movements of the same asset', () => {
        const { deltas } = computeBalanceImpact(
            [
                assetTransfer({
                    sender: OTHER,
                    receiver: USER,
                    assetId: 12n,
                    amount: 100n,
                }), // +100
                assetTransfer({
                    sender: USER,
                    receiver: OTHER,
                    assetId: 12n,
                    amount: 30n,
                }), // -30
            ],
            users,
        )

        expect(deltas).toEqual([{ assetId: '12', amount: 70n }])
    })

    it('ignores transactions that touch neither side of the user’s accounts', () => {
        const { deltas, totalFeeMicroAlgos } = computeBalanceImpact(
            [payment({ sender: OTHER, receiver: OTHER })],
            users,
        )

        expect(deltas).toEqual([])
        expect(totalFeeMicroAlgos).toBe(0n)
    })

    describe('asset creation', () => {
        it('credits every asset the user mints in the group', () => {
            const { createdAssets } = computeBalanceImpact(
                [
                    assetConfig({ unitName: 'MINT1', total: 1n }),
                    assetConfig({
                        unitName: 'MINT2',
                        total: 250n,
                        decimals: 2,
                    }),
                ],
                users,
            )

            expect(createdAssets).toEqual([
                {
                    key: 'created-0',
                    name: 'Minted Asset',
                    unitName: 'MINT1',
                    total: 1n,
                    decimals: 0,
                },
                {
                    key: 'created-1',
                    name: 'Minted Asset',
                    unitName: 'MINT2',
                    total: 250n,
                    decimals: 2,
                },
            ])
        })

        it('ignores a reconfigure of an existing asset and mints by other accounts', () => {
            const { createdAssets } = computeBalanceImpact(
                [
                    assetConfig({ assetId: 31566704n }),
                    assetConfig({ sender: OTHER }),
                ],
                users,
            )

            expect(createdAssets).toEqual([])
        })
    })
})
