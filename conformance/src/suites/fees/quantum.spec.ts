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

// Matches the app's remote-config default (useMinimumFeeConfig's
// FALLBACK_PQ_MULTIPLIER). Fed into the app functions under test as an input —
// never used directly as the expected node-charged value.
const PQ_MULTIPLIER = 3n

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
            pqMultiplier: PQ_MULTIPLIER,
        })
        const expectedFee = baseMinFee + surcharge
        // Sanity: additive composition must agree with the multiplicative
        // definition calculateMinTxnFee uses internally.
        expect(expectedFee).toBe(
            calculateMinTxnFee({
                baseMinFee,
                isPQSigner: true,
                pqMultiplier: PQ_MULTIPLIER,
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
            pqMultiplier: PQ_MULTIPLIER,
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
})
