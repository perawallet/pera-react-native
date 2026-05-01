/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { extractAffectedWalletAddresses } from '../extractAffectedWalletAddresses'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'

const WALLET_A = 'WALLET_A'
const WALLET_B = 'WALLET_B'
const EXTERNAL = 'EXTERNAL'
const EXTERNAL_2 = 'EXTERNAL_2'

const addr = (s: string) => ({ toString: () => s }) as never

const paymentTx = (sender: string, receiver: string, closeTo?: string) =>
    ({
        sender: addr(sender),
        payment: {
            receiver: addr(receiver),
            amount: 0n,
            ...(closeTo ? { closeRemainderTo: addr(closeTo) } : {}),
        },
    }) as unknown as PeraTransaction

const assetTransferTx = (
    sender: string,
    receiver: string,
    extras?: { assetSender?: string; closeTo?: string },
) =>
    ({
        sender: addr(sender),
        assetTransfer: {
            assetId: 0n,
            amount: 0n,
            receiver: addr(receiver),
            ...(extras?.assetSender
                ? { assetSender: addr(extras.assetSender) }
                : {}),
            ...(extras?.closeTo
                ? { closeRemainderTo: addr(extras.closeTo) }
                : {}),
        },
    }) as unknown as PeraTransaction

const otherTx = (sender: string) =>
    ({ sender: addr(sender) }) as unknown as PeraTransaction

describe('extractAffectedWalletAddresses', () => {
    test('returns empty list for empty inputs', () => {
        expect(extractAffectedWalletAddresses([], [WALLET_A])).toEqual([])
        expect(
            extractAffectedWalletAddresses([paymentTx(WALLET_A, EXTERNAL)], []),
        ).toEqual([])
    })

    test('payment: collects sender and receiver when both wallet-held', () => {
        const result = extractAffectedWalletAddresses(
            [paymentTx(WALLET_A, WALLET_B)],
            [WALLET_A, WALLET_B],
        )

        expect(result.sort()).toEqual([WALLET_A, WALLET_B].sort())
    })

    test('payment: includes closeRemainderTo when wallet-held', () => {
        const result = extractAffectedWalletAddresses(
            [paymentTx(WALLET_A, EXTERNAL, WALLET_B)],
            [WALLET_A, WALLET_B],
        )

        expect(result.sort()).toEqual([WALLET_A, WALLET_B].sort())
    })

    test('asset transfer: collects sender, receiver, assetSender, closeTo', () => {
        const result = extractAffectedWalletAddresses(
            [
                assetTransferTx(EXTERNAL, WALLET_A, {
                    assetSender: WALLET_B,
                    closeTo: 'WALLET_C',
                }),
            ],
            [WALLET_A, WALLET_B, 'WALLET_C'],
        )

        expect(result.sort()).toEqual([WALLET_A, WALLET_B, 'WALLET_C'].sort())
    })

    test('non-payment / non-asset-transfer: collects sender only', () => {
        const result = extractAffectedWalletAddresses(
            [otherTx(WALLET_A)],
            [WALLET_A, WALLET_B],
        )

        expect(result).toEqual([WALLET_A])
    })

    test('filters out addresses not held in the wallet', () => {
        const result = extractAffectedWalletAddresses(
            [paymentTx(WALLET_A, EXTERNAL)],
            [WALLET_A, WALLET_B],
        )

        expect(result).toEqual([WALLET_A])
    })

    test('returns empty list when no overlap with wallet', () => {
        const result = extractAffectedWalletAddresses(
            [paymentTx(EXTERNAL, EXTERNAL_2)],
            [WALLET_A, WALLET_B],
        )

        expect(result).toEqual([])
    })

    test('deduplicates when the same wallet address appears in multiple roles', () => {
        const result = extractAffectedWalletAddresses(
            [
                paymentTx(WALLET_A, EXTERNAL),
                paymentTx(EXTERNAL, WALLET_A),
                assetTransferTx(WALLET_A, EXTERNAL),
            ],
            [WALLET_A],
        )

        expect(result).toEqual([WALLET_A])
    })

    test('handles missing optional address fields without throwing', () => {
        const minimalAxfer = {
            sender: addr(WALLET_A),
            assetTransfer: {
                assetId: 0n,
                amount: 0n,
                receiver: addr(EXTERNAL),
            },
        } as unknown as PeraTransaction

        expect(() =>
            extractAffectedWalletAddresses([minimalAxfer], [WALLET_A]),
        ).not.toThrow()
    })
})
