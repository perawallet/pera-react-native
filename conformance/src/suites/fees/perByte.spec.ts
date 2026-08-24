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

import { microAlgo } from '@algorandfoundation/algokit-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import {
    createAlgo25Account,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import type { TxnIntent } from '../../harness/assert/intent'
import { expectConformant } from '../../harness/assert/roundTrip'
import {
    buildTxn,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { getConformanceClient } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'

const balanceOf = async (address: string): Promise<bigint> =>
    (await getConformanceClient().account.getInformation(address)).balance
        .microAlgo

// LocalNet is idle, so algod's own suggested fee-per-byte is 0 and the
// composer's built-in size-dependent fee math never engages — every payment
// floors to the flat minimum regardless of note size. To exercise the
// per-byte path at all, this suite drives a synthetic rate itself (the way a
// congested MainNet would) and pins it via `staticFee`, rather than relying on
// algod's dormant suggestion.
const SYNTHETIC_FEE_PER_BYTE = 5n

const sizeBasedFee = (
    feePerByte: bigint,
    size: bigint,
    minFee: bigint,
): bigint => {
    const scaled = feePerByte * size
    return scaled > minFee ? scaled : minFee
}

describe('per-byte fee conformance', () => {
    let keyStore: ConformanceKeyStore
    let sender: ConformanceAccount
    let receiver: ConformanceAccount

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        sender = await createAlgo25Account(keyStore)
        receiver = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 10_000_000n)
    })

    it('charges more for a large-note payment than a small-note one, in proportion to encoded size', async () => {
        const senderBalanceBefore = await balanceOf(sender.address)
        const amount = 250_000n
        const smallNote = new TextEncoder().encode('c')
        // Both notes stay under msgpack's 256-byte single-length-byte "bin8"
        // boundary, so the note is the only thing that changes the envelope's
        // encoded size — no varint-width jump to muddy the measurement.
        const largeNote = new TextEncoder().encode('c'.repeat(200))

        const { minFee } = await getConformanceClient()
            .client.algod.getTransactionParams()
            .do()
        const baseMinFee = BigInt(minFee)

        // Measure each transaction's real signed envelope size — the ground
        // truth for a per-byte fee, independent of anything algod or the
        // composer suggests. These probe transactions are never submitted.
        const smallProbeTxn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
                note: smallNote,
            })
        })
        const smallProbeSigned = await signWithKeystore(
            keyStore,
            sender,
            smallProbeTxn,
        )
        const largeProbeTxn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
                note: largeNote,
            })
        })
        const largeProbeSigned = await signWithKeystore(
            keyStore,
            sender,
            largeProbeTxn,
        )

        const smallSize = BigInt(smallProbeSigned.length)
        const largeSize = BigInt(largeProbeSigned.length)
        expect(largeSize).toBeGreaterThan(smallSize)

        const expectedSmallFee = sizeBasedFee(
            SYNTHETIC_FEE_PER_BYTE,
            smallSize,
            baseMinFee,
        )
        const expectedLargeFee = sizeBasedFee(
            SYNTHETIC_FEE_PER_BYTE,
            largeSize,
            baseMinFee,
        )
        // The scenario must actually exercise scaling, not just the minimum floor.
        expect(expectedSmallFee).toBeGreaterThan(baseMinFee)
        expect(expectedLargeFee).toBeGreaterThan(expectedSmallFee)

        const smallTxn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
                note: smallNote,
                staticFee: microAlgo(expectedSmallFee),
            })
        })
        const smallSignedBytes = await signWithKeystore(
            keyStore,
            sender,
            smallTxn,
        )
        const { txId: smallTxId } = await submitAndConfirm(smallSignedBytes)

        const smallIntent: TxnIntent = {
            type: 'pay',
            sender: sender.address,
            receiver: receiver.address,
            amount,
            note: smallNote,
            fee: expectedSmallFee,
        }
        await expectConformant({
            intent: smallIntent,
            signedBytes: smallSignedBytes,
            txId: smallTxId,
            senderBalanceBefore,
        })

        const senderBalanceBeforeLarge = await balanceOf(sender.address)
        const largeTxn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
                note: largeNote,
                staticFee: microAlgo(expectedLargeFee),
            })
        })
        const largeSignedBytes = await signWithKeystore(
            keyStore,
            sender,
            largeTxn,
        )
        const { txId: largeTxId } = await submitAndConfirm(largeSignedBytes)

        const largeIntent: TxnIntent = {
            type: 'pay',
            sender: sender.address,
            receiver: receiver.address,
            amount,
            note: largeNote,
            fee: expectedLargeFee,
        }
        // Load-bearing: each intent's fee is the independently-measured,
        // independently-scaled expectation, compared against what the chain
        // actually charged — never a value read off either built transaction.
        await expectConformant({
            intent: largeIntent,
            signedBytes: largeSignedBytes,
            txId: largeTxId,
            senderBalanceBefore: senderBalanceBeforeLarge,
        })
    })
})
