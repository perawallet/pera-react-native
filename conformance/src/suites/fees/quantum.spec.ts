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

import { FALLBACK_PQ_MULTIPLIER } from '@perawallet/wallet-core-blockchain/constants'
import {
    calculatePQFeeSurcharge,
    calculateMinTxnFee,
} from '@perawallet/wallet-core-blockchain/fees/feeCalculator'

import {
    createAlgo25Account,
    createQuantumAccount,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import type { TxnIntent } from '../../harness/assert/intent'
import { expectConformant } from '../../harness/assert/roundTrip'
import {
    buildGroup,
    buildTxn,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { balanceOf, getConformanceClient } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'

describe('quantum fee conformance', () => {
    let keyStore: ConformanceKeyStore
    let sender: ConformanceAccount
    let receiver: ConformanceAccount

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        sender = await createQuantumAccount(keyStore)
        receiver = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 10_000_000n)
    })

    it('charges baseMinFee + the PQ surcharge, additively, for a quantum-signed payment', async () => {
        const senderBalanceBefore = await balanceOf(sender.address)
        const amount = 250_000n

        const { minFee } = await getConformanceClient()
            .client.algod.getTransactionParams()
            .do()
        const baseMinFee = BigInt(minFee)
        // Additive, not a 3x total: `calculatePQFeeSurcharge` returns only the
        // premium on top of the base fee (feeCalculator.ts), so the expectation
        // is composed by addition — the same shape a bug that re-derives a
        // multiplier instead would fail to match.
        const surcharge = calculatePQFeeSurcharge({
            baseMinFee,
            pqMultiplier: FALLBACK_PQ_MULTIPLIER,
        })
        const expectedFee = baseMinFee + surcharge
        // Sanity: additive composition must agree with the multiplicative
        // definition calculateMinTxnFee uses internally.
        expect(expectedFee).toBe(
            calculateMinTxnFee({
                baseMinFee,
                isPQSigner: true,
                pqMultiplier: FALLBACK_PQ_MULTIPLIER,
            }),
        )

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
                staticFee: microAlgo(expectedFee),
            })
        })
        const signedBytes = await signWithKeystore(keyStore, sender, txn)
        const { txId } = await submitAndConfirm(signedBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: sender.address,
            receiver: receiver.address,
            amount,
            fee: expectedFee,
        }

        // Load-bearing: `expectedFee` is derived entirely from algod's own
        // minFee plus the app's surcharge function, never from `txn.fee`, and
        // is compared against what the chain actually charged a real
        // Falcon-1024-signed transaction.
        //
        // Caveat (see the next two tests): for this plain, minimal, lone
        // payment, `baseMinFee + surcharge` and `baseMinFee * pqMultiplier`
        // are numerically identical (per feeCalculator.ts's own JSDoc, the two
        // models only diverge when the transaction already carries an
        // elevated fee — a pooled group or an oversized note). This test and
        // algod's own rejection message below ("usage=3.000000 * base=1mA")
        // confirm `pqMultiplier = 3` is the right scalar in that degenerate
        // case; they do not by themselves distinguish additive-on-top-of-
        // elevated from a flat 3x total.
        await expectConformant({
            intent,
            signedBytes,
            txId,
            senderBalanceBefore,
        })
    })

    it('rejects the same payment one microAlgo under the PQ minimum', async () => {
        const amount = 250_000n

        const { minFee } = await getConformanceClient()
            .client.algod.getTransactionParams()
            .do()
        const baseMinFee = BigInt(minFee)
        const expectedFee = calculateMinTxnFee({
            baseMinFee,
            isPQSigner: true,
            pqMultiplier: FALLBACK_PQ_MULTIPLIER,
        })

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
                staticFee: microAlgo(expectedFee - 1n),
            })
        })
        const signedBytes = await signWithKeystore(keyStore, sender, txn)

        // Proves `expectedFee` is the true node-enforced minimum, not merely a
        // sufficient value — the surcharge is enforced by the chain, not just
        // self-imposed by the wallet. algod's own rejection ("txgroup with
        // 2.999mA fees is less than 3mA (usage=3.000000 * base=1mA)") confirms
        // the 3x usage factor independently of anything this suite asserts.
        await expect(submitAndConfirm(signedBytes)).rejects.toThrow(/less than/)
    })

    it('adds the surcharge on top of an already-elevated pooled fee, rather than clamping to a flat PQ minimum', async () => {
        // The case feeCalculator.ts's JSDoc calls out as the one that actually
        // distinguishes the two models: a quantum-signed leg in a group that
        // ALSO needs to cover a sibling's zero-fee leg. Before any PQ
        // surcharge, this leg already needs `2 * baseMinFee` (its own plus the
        // sibling's) — the "already-elevated fee" the surcharge must be added
        // on top of, not replaced by a flat `baseMinFee * pqMultiplier`.
        const sibling = await createAlgo25Account(keyStore)
        const siblingReceiver = await createAlgo25Account(keyStore)
        await fundAccount(sibling.address, 10_000_000n)

        const { minFee } = await getConformanceClient()
            .client.algod.getTransactionParams()
            .do()
        const baseMinFee = BigInt(minFee)
        const surcharge = calculatePQFeeSurcharge({
            baseMinFee,
            pqMultiplier: FALLBACK_PQ_MULTIPLIER,
        })
        const poolingRequirement = baseMinFee * 2n // this leg's own + the zero-fee sibling's
        const additiveExpectedFee = poolingRequirement + surcharge
        // The bug this test exists to catch: clamping to the flat PQ minimum
        // discards the pooling requirement entirely.
        const naiveClampedFee = calculateMinTxnFee({
            baseMinFee,
            isPQSigner: true,
            pqMultiplier: FALLBACK_PQ_MULTIPLIER,
        })
        expect(naiveClampedFee).toBeLessThan(additiveExpectedFee)

        const amountQ = 250_000n
        const amountZero = 260_000n

        const [legQ, legZero] = await buildGroup(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amountQ),
                staticFee: microAlgo(additiveExpectedFee),
            })
            composer.addPayment({
                sender: sibling.address,
                receiver: siblingReceiver.address,
                amount: microAlgo(amountZero),
                staticFee: microAlgo(0n),
            })
        })
        const signed = [
            await signWithKeystore(keyStore, sender, legQ),
            await signWithKeystore(keyStore, sibling, legZero),
        ]
        const { txIds } = await submitAndConfirm(signed)

        const baseIntent = { type: 'pay' as const, groupSize: 2 }
        await expectConformant({
            intent: {
                ...baseIntent,
                sender: sender.address,
                receiver: receiver.address,
                amount: amountQ,
                fee: additiveExpectedFee,
            },
            signedBytes: signed[0],
            txId: txIds[0],
        })
        await expectConformant({
            intent: {
                ...baseIntent,
                sender: sibling.address,
                receiver: siblingReceiver.address,
                amount: amountZero,
                fee: 0n,
            },
            signedBytes: signed[1],
            txId: txIds[1],
        })

        // Load-bearing: the naive clamped total, which ignores the pooling
        // requirement, is rejected by the real node — proving the additive
        // model is not just sufficient but necessary. Different amounts from
        // the accepted group above, so this is a genuinely distinct txgroup.
        const [legQNaive, legZeroNaive] = await buildGroup(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amountQ + 1n),
                staticFee: microAlgo(naiveClampedFee),
            })
            composer.addPayment({
                sender: sibling.address,
                receiver: siblingReceiver.address,
                amount: microAlgo(amountZero + 1n),
                staticFee: microAlgo(0n),
            })
        })
        const signedNaive = [
            await signWithKeystore(keyStore, sender, legQNaive),
            await signWithKeystore(keyStore, sibling, legZeroNaive),
        ]
        await expect(submitAndConfirm(signedNaive)).rejects.toThrow(/less than/)
    })
})
