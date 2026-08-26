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
import { beforeAll, describe, it } from 'vitest'

import { FALLBACK_PQ_MULTIPLIER } from '@perawallet/wallet-core-blockchain/constants'
import { calculateMinTxnFee } from '@perawallet/wallet-core-blockchain/fees/feeCalculator'

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
import { balanceOf, getConformanceClient } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'

describe('minimum fee conformance', () => {
    let keyStore: ConformanceKeyStore
    let sender: ConformanceAccount
    let receiver: ConformanceAccount

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        sender = await createAlgo25Account(keyStore)
        receiver = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 10_000_000n)
    })

    it('charges exactly calculateMinTxnFee for a minimal, non-quantum payment', async () => {
        const senderBalanceBefore = await balanceOf(sender.address)
        const amount = 250_000n

        const { minFee } = await getConformanceClient()
            .client.algod.getTransactionParams()
            .do()
        // The app's own fee function, fed algod's real minimum — never a value
        // read off the built transaction. This is the load-bearing expectation:
        // expectConformant compares it against what the chain actually charged.
        const expectedFee = calculateMinTxnFee({
            baseMinFee: BigInt(minFee),
            isPQSigner: false,
            pqMultiplier: FALLBACK_PQ_MULTIPLIER,
        })

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
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

        // expectConformant checks `expectedFee` against both the node-charged fee
        // and the sender's balance delta it derives from the confirmed
        // transaction — two independent confirmations of the same value.
        await expectConformant({
            intent,
            signedBytes,
            txId,
            senderBalanceBefore,
        })
    })
})
